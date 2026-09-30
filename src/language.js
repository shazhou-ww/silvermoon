export const DEFAULT_LANGUAGE = "en-US";
export const OUTPUT_LANGUAGES = Object.freeze(["en-US", "zh-CN"]);

const OUTPUT_LANGUAGE_SET = new Set(OUTPUT_LANGUAGES);

export function isChinese(language) {
  return language?.toLowerCase().startsWith("zh") ?? false;
}

export function localize(language, english, chinese) {
  return isChinese(language) ? chinese : english;
}

export function canonicalizeLanguageTag(value) {
  if (typeof value !== "string" || value.length === 0 || value.trim() !== value) {
    throw new Error("language tag must be a non-empty trimmed string");
  }
  try {
    const [canonical] = Intl.getCanonicalLocales(value);
    if (!canonical) throw new Error("language tag is empty");
    return canonical;
  } catch {
    throw new Error(`invalid BCP 47 language tag: ${value}`);
  }
}

export function isCanonicalLanguageTag(value) {
  try {
    return canonicalizeLanguageTag(value) === value;
  } catch {
    return false;
  }
}

export function canonicalizeOutputLanguage(value) {
  let canonical;
  try {
    canonical = canonicalizeLanguageTag(value);
  } catch (caught) {
    caught.exitCode = 2;
    throw caught;
  }
  canonical = {
    en: "en-US",
    zh: "zh-CN",
  }[canonical.toLowerCase()] ?? canonical;
  if (!OUTPUT_LANGUAGE_SET.has(canonical)) {
    const error = new Error(
      `unsupported output language: ${canonical}; expected ${OUTPUT_LANGUAGES.join(" or ")}`,
    );
    error.exitCode = 2;
    throw error;
  }
  return canonical;
}

export function resolveLanguage({ idea, project, global } = {}) {
  if (idea !== undefined) return { tag: idea, source: "idea" };
  if (project !== undefined) return { tag: project, source: "project" };
  if (global !== undefined) return { tag: global, source: "global" };
  return { tag: DEFAULT_LANGUAGE, source: "default" };
}

export function resolveOutputLanguage({ content, override } = {}) {
  if (override !== undefined) {
    return {
      tag: canonicalizeOutputLanguage(override),
      source: "override",
    };
  }
  if (content?.toLowerCase().startsWith("zh")) {
    return { tag: "zh-CN", source: "content" };
  }
  return {
    tag: DEFAULT_LANGUAGE,
    source: content === undefined ? "default" : "content",
  };
}
