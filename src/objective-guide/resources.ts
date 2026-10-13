import { lstat, readdir, readFile } from "node:fs/promises";
import { isAbsolute, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { parseStrictYaml } from "../foundation/schema/index.ts";
import type { ObjectivePageResource, ObjectiveResourceResolver, ReferencePage } from "./types.ts";
import { fields, immutable, ObjectiveConfigurationError, record, text } from "./validation.ts";

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
      } else if (!metadata.isFile()) throw new ObjectiveConfigurationError(`Invalid References resource: ${path}.`);
    }
    await walk(root);
    return pages;
  },
};

export function parsePage(resource: ObjectivePageResource): ReferencePage {
  const normalized = resource.source.replace(/\r\n/g, "\n");
  const match = /^---\n([\s\S]*?)\n---\n([\s\S]*)$/.exec(normalized);
  if (match === null) throw new ObjectiveConfigurationError(`Reference page needs frontmatter: ${resource.uri}.`);
  const metadata: unknown = parseStrictYaml(match[1]!);
  if (!record(metadata)) throw new ObjectiveConfigurationError(`Invalid page metadata: ${resource.uri}.`);
  fields(metadata, ["id"]);
  const content = match[2]!.trim();
  const heading = /^#\s+(.+)$/m.exec(content)?.[1]?.trim();
  if (!text(metadata.id) || !text(heading) || !text(content)) {
    throw new ObjectiveConfigurationError(`Reference page needs an ID, title and content: ${resource.uri}.`);
  }
  return immutable({ id: metadata.id, title: heading, content });
}

export function validatePages(resources: readonly ObjectivePageResource[], sourceUri: string, notFoundPageId?: string) {
  const pages = new Map<string, ReferencePage>();
  const uris = new Set<string>();
  const defaultUri = new URL("404.md", sourceUri.endsWith("/") ? sourceUri : `${sourceUri}/`).href;
  let hasDefault = false;
  for (const resource of resources) {
    const uri = canonicalManifestUri(resource.uri);
    const page = parsePage(resource);
    if (uris.has(uri) || pages.has(page.id)) throw new ObjectiveConfigurationError(`Duplicate References identity: ${page.id}.`);
    uris.add(uri);
    pages.set(page.id, page);
    if (uri === defaultUri) {
      if (notFoundPageId === undefined && page.id !== "404") throw new ObjectiveConfigurationError('Default 404.md must have id: "404".');
      hasDefault = true;
    }
  }
  const fallbackId = notFoundPageId ?? "404";
  if ((notFoundPageId === undefined && !hasDefault) || !pages.has(fallbackId)) {
    throw new ObjectiveConfigurationError(`Missing not-found page: ${fallbackId}.`);
  }
  for (const page of pages.values()) {
    for (const match of page.content.matchAll(/\[\[([^\]|]+)(?:\|[^\]]*)?\]\]/g)) {
      if (!pages.has(match[1]!)) throw new ObjectiveConfigurationError(`Dangling References link: ${match[1]}.`);
    }
  }
  return { pages, fallbackId };
}
