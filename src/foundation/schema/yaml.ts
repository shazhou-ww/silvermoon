import { isAlias, isMap, isNode, isScalar, parseDocument, stringify, visit } from "yaml";
import type { Document } from "yaml";

/** @pure */
function unsupportedFeature(document: Document) {
  if (document.commentBefore || document.comment) return true;
  if (document.directives?.docStart || document.directives?.docEnd) return true;
  if (document.directives?.yaml?.explicit) return true;
  const tags = Object.entries(document.directives?.tags ?? {});
  if (
    tags.length !== 1 ||
    tags[0]?.[0] !== "!!" ||
    tags[0]?.[1] !== "tag:yaml.org,2002:"
  ) {
    return true;
  }

  let unsupported = false;
  visit(document, (_key, node) => {
    if (
      isAlias(node) ||
      (isNode(node) && (
        node.anchor ||
        node.tag ||
        node.commentBefore ||
        node.comment
      ))
    ) {
      unsupported = true;
      return visit.BREAK;
    }
    if (
      isMap(node) &&
      node.items.some((item) => isScalar(item.key) && item.key.value === "<<")
    ) {
      unsupported = true;
      return visit.BREAK;
    }
    return undefined;
  });
  return unsupported;
}

/** @pure */
export function parseStrictYaml(source: string) {
  const document = parseDocument(source, {
    prettyErrors: false,
    strict: true,
    uniqueKeys: true,
    version: "1.2",
  });
  if (document.errors.length > 0 || document.warnings.length > 0) {
    throw new Error(
      document.errors[0]?.message ?? document.warnings[0]?.message ?? "Invalid YAML",
    );
  }
  if (unsupportedFeature(document)) {
    throw new Error("Comments, directives, anchors, aliases, merge keys, and tags are not supported");
  }
  return document.toJS({ maxAliasCount: 0 });
}

/** @pure */
export function stringifyCanonicalYaml(value: { version: unknown; primaryRepository?: unknown; primaryBranch?: unknown; id?: unknown; }) {
  return stringify(value, {
    defaultKeyType: "PLAIN",
    defaultStringType: "PLAIN",
    indent: 2,
    lineWidth: 0,
  });
}
