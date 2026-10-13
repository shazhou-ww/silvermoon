import { lstat, readdir, readFile } from "node:fs/promises";
import { isAbsolute, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { parseStrictYaml } from "../foundation/schema/index.ts";
import type {
  ObjectiveGuideManifest, ObjectivePageResource, ObjectiveResourceResolver, ReferencePage,
} from "./types.ts";
import { fields, identifier, immutable, ObjectiveConfigurationError, record, text } from "./validation.ts";

export interface LoadedReferencePage extends ReferencePage {
  outcome?: string;
  instruction?: string;
}
export interface LoadedLocale {
  pages: ReadonlyMap<string, LoadedReferencePage>;
}

export function canonicalManifestUri(uri: string, base?: string): string {
  try {
    const url = base === undefined && isAbsolute(uri) ? pathToFileURL(uri) : new URL(uri, base);
    if (url.hash || url.username || url.password || (url.protocol === "file:" && url.search)) {
      throw new ObjectiveConfigurationError("Manifest URI cannot carry credentials, fragments or file queries.");
    }
    if (url.protocol === "file:") return pathToFileURL(fileURLToPath(url)).href;
    const normalize = (value: string) => value.replace(/%[0-9a-f]{2}/gi, (escape) => {
      const character = String.fromCharCode(Number.parseInt(escape.slice(1), 16));
      return /^[A-Za-z0-9._~-]$/.test(character) ? character : escape.toUpperCase();
    });
    url.pathname = normalize(url.pathname);
    url.search = normalize(url.search);
    return url.href;
  } catch (caught) {
    if (caught instanceof ObjectiveConfigurationError) throw caught;
    if (!(caught instanceof Error)) throw caught;
    throw new ObjectiveConfigurationError(`Invalid Manifest URI: ${uri}.`, { cause: caught });
  }
}
export const fileObjectiveResources: ObjectiveResourceResolver = {
  async readText(uri) {
    if (new URL(uri).protocol !== "file:") throw new ObjectiveConfigurationError(`Unsupported resource URI: ${uri}.`);
    return new TextDecoder("utf-8", { fatal: true }).decode(await readFile(fileURLToPath(uri)));
  },
  async readPages(sourceUri) {
    if (new URL(sourceUri).protocol !== "file:") throw new ObjectiveConfigurationError(`Unsupported References URI: ${sourceUri}.`);
    const root = fileURLToPath(sourceUri);
    const rootMetadata = await lstat(root);
    if (!rootMetadata.isDirectory() || rootMetadata.isSymbolicLink()) {
      throw new ObjectiveConfigurationError("References source must be a regular directory.");
    }
    const pages: ObjectivePageResource[] = [];
    async function walk(path: string) {
      const metadata = await lstat(path);
      if (metadata.isSymbolicLink()) throw new ObjectiveConfigurationError(`References cannot follow symlinks: ${path}.`);
      if (metadata.isDirectory()) {
        for (const name of (await readdir(path)).sort()) await walk(join(path, name));
      } else if (metadata.isFile() && path.endsWith(".md")) {
        pages.push({ uri: pathToFileURL(path).href,
          source: new TextDecoder("utf-8", { fatal: true }).decode(await readFile(path)) });
      } else {
        throw new ObjectiveConfigurationError(`Invalid References resource: ${path}.`);
      }
    }
    await walk(root);
    return pages;
  },
};

function parsePage(resource: ObjectivePageResource, id: string, namespace: string): LoadedReferencePage {
  const normalized = resource.source.replace(/\r\n/g, "\n");
  const match = /^---\n([\s\S]*?)\n---(?:\n([\s\S]*))?$/.exec(normalized);
  if (match === null) throw new ObjectiveConfigurationError(`Reference page needs frontmatter: ${resource.uri}.`);
  const metadata: unknown = parseStrictYaml(match[1]!);
  if (!record(metadata)) throw new ObjectiveConfigurationError(`Invalid page metadata: ${resource.uri}.`);
  const required = namespace === "levels" && id !== "levels/terminal"
    ? ["title", "description", "outcome"]
    : namespace === "pages" ? ["title"] : ["title", "description"];
  const optional = namespace === "pages" ? ["description"] : namespace === "problems" ? ["instruction"] : [];
  fields(metadata, required, optional);
  if (!required.every((field) => text(metadata[field]))
    || optional.some((field) => Object.hasOwn(metadata, field) && !text(metadata[field]))) {
    throw new ObjectiveConfigurationError(`Incomplete page metadata: ${resource.uri}.`);
  }
  const content = (match[2] ?? "").trim();
  return immutable({
    id,
    title: String(metadata.title),
    ...(typeof metadata.description === "string" ? { description: metadata.description } : {}),
    ...(typeof metadata.outcome === "string" ? { outcome: metadata.outcome } : {}),
    ...(typeof metadata.instruction === "string" ? { instruction: metadata.instruction } : {}),
    content,
  });
}

export function validateReferences(
  resources: readonly ObjectivePageResource[],
  sourceUri: string,
  manifest: ObjectiveGuideManifest,
): ReadonlyMap<string, LoadedLocale> {
  const root = canonicalManifestUri(sourceUri.endsWith("/") ? sourceUri : `${sourceUri}/`);
  const languages = new Set(manifest.languages);
  const levelIds = new Set(manifest.levels.map(({ id }) => id));
  const checkIds = new Set(manifest.levels.flatMap(({ advancement }) => advancement.checks));
  const nodes = new Map<string, Map<string, LoadedReferencePage>>();
  for (const resource of resources) {
    const uri = canonicalManifestUri(resource.uri);
    if (!uri.startsWith(root)) throw new ObjectiveConfigurationError(`Reference escapes source: ${uri}.`);
    const parts = decodeURIComponent(uri.slice(root.length)).split("/");
    if (parts.length !== 3 || !parts[2]!.endsWith(".md")) {
      throw new ObjectiveConfigurationError(`References require <namespace>/<id>/<language>.md: ${uri}.`);
    }
    const [namespace, localId, file] = parts as [string, string, string];
    const language = file.slice(0, -3);
    if (!["system", "levels", "checks", "problems", "pages"].includes(namespace)
      || !identifier(localId) || !languages.has(language)) {
      throw new ObjectiveConfigurationError(`Invalid Reference identity or language: ${uri}.`);
    }
    if (namespace === "system" && !["overview", "404"].includes(localId)) {
      throw new ObjectiveConfigurationError(`Unknown system Reference: ${localId}.`);
    }
    if (namespace === "levels" && localId !== "terminal" && !levelIds.has(localId)) {
      throw new ObjectiveConfigurationError(`Unknown level Reference: ${localId}.`);
    }
    if (namespace === "checks" && !checkIds.has(localId)) {
      throw new ObjectiveConfigurationError(`Unknown check Reference: ${localId}.`);
    }
    const id = `${namespace}/${localId}`;
    const locales = nodes.get(id) ?? new Map<string, LoadedReferencePage>();
    if (locales.has(language)) throw new ObjectiveConfigurationError(`Duplicate Reference locale: ${id}/${language}.`);
    locales.set(language, parsePage(resource, id, namespace));
    nodes.set(id, locales);
  }
  const required = [
    "system/overview", "system/404", "levels/terminal",
    ...[...levelIds].map((id) => `levels/${id}`),
    ...[...checkIds].map((id) => `checks/${id}`),
  ];
  for (const id of required) {
    if (!nodes.has(id)) throw new ObjectiveConfigurationError(`Missing Reference: ${id}.`);
  }
  for (const [id, locales] of nodes) {
    if (locales.size !== languages.size || [...languages].some((language) => !locales.has(language))) {
      throw new ObjectiveConfigurationError(`Reference must cover every language: ${id}.`);
    }
  }
  for (const locales of nodes.values()) for (const page of locales.values()) {
    for (const match of page.content.matchAll(/\[\[([^\]|]+)(?:\|[^\]]*)?\]\]/g)) {
      if (!nodes.has(match[1]!)) throw new ObjectiveConfigurationError(`Dangling References link: ${match[1]}.`);
    }
  }
  return new Map(manifest.languages.map((language) => [language, {
    pages: new Map([...nodes].map(([id, locales]) => [id, locales.get(language)!])),
  }]));
}
