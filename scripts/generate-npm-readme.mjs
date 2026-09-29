import { readFile, rename, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const repositoryRoot = fileURLToPath(new URL("..", import.meta.url));
const repository = "shazhou-ww/silvermoon";
const jsDelivrRepository = `https://cdn.jsdelivr.net/gh/${repository}`;
const jsDelivrMainPrefix = `${jsDelivrRepository}@main/`;
const rawMainPrefix = `https://raw.githubusercontent.com/${repository}/main/`;
const fullObjectIdPattern = /^[0-9a-f]{40,64}$/i;
const readmeSources = new Set(["README.md", "README.zh-CN.md"]);

function validateCommit(commit) {
  if (!fullObjectIdPattern.test(commit ?? "")) {
    throw new Error("Release commit must be a full hexadecimal Git object ID.");
  }
  return commit;
}

function blobUrl(commit, path, anchor = "") {
  return `https://github.com/${repository}/blob/${commit}/${path}${anchor}`;
}

function rewriteMarkdownRelativeLinks(source, commit) {
  return source.replace(
    /(?<!!)\]\(\.\/([^)\s#]+)(#[^)\s]*)?(?:\s+(?:"[^"]*"|'[^']*'))?\)/g,
    (_match, path, anchor = "") => `](${blobUrl(commit, path, anchor)})`,
  );
}

function rewriteHtmlRelativeHrefs(source, commit) {
  return source.replace(
    /href=(["'])\.\/([^"'#\s]+)(#[^"']*)?\1/g,
    (_match, quote, path, anchor = "") =>
      `href=${quote}${blobUrl(commit, path, anchor)}${quote}`,
  );
}

function stripMarkdownLinkTitle(destination) {
  const titled = /^(.*?)\s+(?:"[^"]*"|'[^']*')$/.exec(destination);
  return titled ? titled[1] : destination;
}

function normalizeDestination(destination) {
  const normalized = stripMarkdownLinkTitle(destination.trim());
  if (normalized.startsWith("<") && normalized.endsWith(">")) {
    return normalized.slice(1, -1);
  }
  return normalized;
}

function isRelativeRepositoryReference(destination) {
  return (
    !/^[a-z][a-z0-9+.-]*:/i.test(destination) &&
    !destination.startsWith("#") &&
    !destination.startsWith("//")
  );
}

function assertNoRelativeResourceRefs(source) {
  for (const match of source.matchAll(/!\[[^\]]*\]\(([^)]+)\)/g)) {
    const destination = normalizeDestination(match[1]);
    if (isRelativeRepositoryReference(destination)) {
      throw new Error(
        `Relative repository Markdown image is not allowed: ${destination}`,
      );
    }
  }

  for (const match of source.matchAll(/\bsrc=(["'])(.*?)\1/gi)) {
    const destination = match[2].trim();
    if (isRelativeRepositoryReference(destination)) {
      throw new Error(
        `Relative repository HTML resource is not allowed: ${destination}`,
      );
    }
  }
}

function assertFullObjectId(reference, kind) {
  if (!fullObjectIdPattern.test(reference ?? "")) {
    throw new Error(
      `${kind} must use a full Git object ID; refusing movable reference ${reference ?? "(missing)"}.`,
    );
  }
}

function assertImmutableHostedRefs(source, releaseCommit) {
  const jsDelivrPattern =
    /https:\/\/cdn\.jsdelivr\.net\/gh\/([^/\s@"'<>]+)\/([^/@\s)"'<>]+)(?:@([^/\s)"'<>]+))?(?=\/|[\s)"'<>]|$)/gi;
  for (const match of source.matchAll(jsDelivrPattern)) {
    const referencedRepository = `${match[1]}/${match[2]}`;
    const reference = match[3];
    assertFullObjectId(reference, "jsDelivr GitHub reference");
    if (
      referencedRepository.toLowerCase() === repository.toLowerCase() &&
      reference.toLowerCase() !== releaseCommit.toLowerCase()
    ) {
      throw new Error(
        `Silvermoon jsDelivr reference must use release commit ${releaseCommit}.`,
      );
    }
  }

  const rawGitHubPattern =
    /https:\/\/raw\.githubusercontent\.com\/([^/\s"'<>]+)\/([^/\s"'<>]+)\/([^/\s)"'<>]+)(?=\/)/gi;
  for (const match of source.matchAll(rawGitHubPattern)) {
    assertFullObjectId(match[3], "raw.githubusercontent.com reference");
    if (`${match[1]}/${match[2]}`.toLowerCase() === repository.toLowerCase()) {
      throw new Error(
        "Silvermoon raw.githubusercontent.com references must use the jsDelivr GitHub endpoint.",
      );
    }
  }

  const githubFilePattern =
    /https:\/\/github\.com\/[^/\s"'<>]+\/[^/\s"'<>]+\/(?:blob|raw|tree)\/([^/\s)"'<>]+)(?=\/)/gi;
  for (const match of source.matchAll(githubFilePattern)) {
    assertFullObjectId(match[1], "GitHub file reference");
  }
}

function assertNoMovableOrRelativeRefs(source, releaseCommit) {
  assertImmutableHostedRefs(source, releaseCommit);

  for (const match of source.matchAll(/\]\(([^)]+)\)/g)) {
    const destination = normalizeDestination(match[1]);
    if (isRelativeRepositoryReference(destination)) {
      throw new Error(
        `Unrecognized relative repository Markdown link: ${destination}`,
      );
    }
  }

  for (const match of source.matchAll(/\b(?:href|src)=(["'])(.*?)\1/gi)) {
    const destination = match[2].trim();
    if (isRelativeRepositoryReference(destination)) {
      throw new Error(
        `Unrecognized relative repository HTML reference: ${destination}`,
      );
    }
  }
}

export function generateNpmReadme({ source, commit }) {
  const releaseCommit = validateCommit(commit);
  if (typeof source !== "string") {
    throw new Error("README source must be a string.");
  }
  if (source.trim().length === 0) {
    throw new Error("README source is empty; refusing to generate an empty npm README.");
  }
  assertNoRelativeResourceRefs(source);

  let result = source.replaceAll(
    jsDelivrMainPrefix,
    `${jsDelivrRepository}@${releaseCommit}/`,
  );
  result = result.replaceAll(
    rawMainPrefix,
    `${jsDelivrRepository}@${releaseCommit}/`,
  );
  result = rewriteMarkdownRelativeLinks(result, releaseCommit);
  result = rewriteHtmlRelativeHrefs(result, releaseCommit);
  assertNoMovableOrRelativeRefs(result, releaseCommit);
  if (result.trim().length === 0) {
    throw new Error("Generated npm README is empty; refusing to publish it.");
  }
  return result;
}

function parseArguments(argv) {
  const values = {};
  for (let index = 0; index < argv.length; index += 2) {
    const option = argv[index];
    const value = argv[index + 1];
    if (!value || !["--commit", "--out", "--source"].includes(option)) {
      throw new Error(
        "Usage: node scripts/generate-npm-readme.mjs --commit <sha> [--source <path>] [--out <path>]",
      );
    }
    values[option.slice(2)] = value;
  }
  if (!values.commit) {
    throw new Error(
      "Usage: node scripts/generate-npm-readme.mjs --commit <sha> [--source <path>] [--out <path>]",
    );
  }
  return values;
}

async function main() {
  const { commit, out, source = "README.md" } = parseArguments(
    process.argv.slice(2),
  );
  if (!readmeSources.has(source)) {
    throw new Error(`Unsupported README source: ${source}`);
  }
  const sourcePath = resolve(repositoryRoot, source);
  const sourceText = await readFile(sourcePath, "utf8");
  const generated = generateNpmReadme({ source: sourceText, commit });
  if (out) {
    // Atomic write: never truncate the destination before the content exists.
    // A shell redirect (`> README.md`) would empty the source file before this
    // script reads it; --out exists so the release workflow cannot do that.
    const target = resolve(out);
    const temporary = `${target}.generated-tmp`;
    await writeFile(temporary, generated, "utf8");
    await rename(temporary, target);
    return;
  }
  process.stdout.write(generated);
}

const invokedUrl = process.argv[1] ? pathToFileURL(resolve(process.argv[1])).href : null;
if (invokedUrl === import.meta.url) {
  main().catch((error) => {
    process.stderr.write(`npm README generation failed: ${error.message}\n`);
    process.exitCode = 1;
  });
}
