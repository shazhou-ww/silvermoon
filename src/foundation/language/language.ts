export const DEFAULT_LANGUAGE = "en-US";
export const OUTPUT_LANGUAGES = Object.freeze(["en-US", "zh-CN"] as const);

export type OutputLanguage = (typeof OUTPUT_LANGUAGES)[number];

const OUTPUT_LANGUAGE_SET = new Set<string>(OUTPUT_LANGUAGES);

/** @pure */
export function isChinese(language: string) {
  return language?.toLowerCase().startsWith("zh") ?? false;
}

/** @pure */
export function localize(language: string, english: string, chinese: string) {
  return isChinese(language) ? chinese : english;
}

/** @pure */
export function canonicalizeLanguageTag(value: string|number|readonly string[]|null|undefined) {
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

/** @pure */
export function isCanonicalLanguageTag(value: string|number|null) {
  try {
    return canonicalizeLanguageTag(value) === value;
  } catch {
    return false;
  }
}

/** @pure */
export function canonicalizeOutputLanguage(value: string) {
  let canonical;
  try {
    canonical = canonicalizeLanguageTag(value);
  } catch (caught) {
    const error = caught instanceof Error ? caught : new Error(String(caught));
    Object.assign(error, { exitCode: 2 });
    throw error;
  }
  canonical = {
    en: "en-US",
    zh: "zh-CN",
  }[canonical.toLowerCase()] ?? canonical;
  if (!OUTPUT_LANGUAGE_SET.has(canonical)) {
    const error = new Error(
      `unsupported output language: ${canonical}; expected ${OUTPUT_LANGUAGES.join(" or ")}`,
    );
    throw Object.assign(error, { exitCode: 2 });
  }
  return canonical;
}

/** @pure */
export function resolveLanguage({
  idea,
  project,
  global,
}: { idea?: string; project?: string; global?: string } = {}) {
  if (idea !== undefined) return { tag: idea, source: "idea" };
  if (project !== undefined) return { tag: project, source: "project" };
  if (global !== undefined) return { tag: global, source: "global" };
  return { tag: DEFAULT_LANGUAGE, source: "default" };
}

/** @pure */
export function resolveOutputLanguage({
  content,
  override,
}: { content?: string; override?: string } = {}) {
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

/** @pure */
export function resolveContentTemplateLanguage(contentLanguage: string): {
  tag: OutputLanguage;
  localized: boolean;
} {
  const normalized = contentLanguage.toLowerCase();
  if (normalized === "zh" || normalized.startsWith("zh-")) {
    return { tag: "zh-CN", localized: true };
  }
  if (normalized === "en" || normalized.startsWith("en-")) {
    return { tag: "en-US", localized: true };
  }
  return { tag: "en-US", localized: false };
}
