/**
 * @template content-language
 * @when idea.selected=true
 * Used for every selected idea to preserve its effective content language.
 */
import type { ContentLanguageParameters } from "../contract.ts";

/** @pure */
const contentLanguage = ({
  contentLanguage: language,
}: ContentLanguageParameters) =>
  [
    `Use ${language} for natural-language content in the current world,`,
    `its supporting files, and the ledger.`,
    `Preserve canonical headings, stable IDs, paths, and machine fields.`,
  ].join(" ");

export default contentLanguage;
