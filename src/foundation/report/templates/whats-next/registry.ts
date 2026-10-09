import { isChinese } from "../../../language/index.ts";
import enUsTemplates from "./en-US/index.ts";
import zhCnTemplates from "./zh-CN/index.ts";
import type { WhatsNextTemplates } from "./contract.ts";

const TEMPLATE_REGISTRY = Object.freeze({
  "en-US": enUsTemplates,
  "zh-CN": zhCnTemplates,
}) satisfies Readonly<Record<"en-US" | "zh-CN", WhatsNextTemplates>>;

/** @pure */
export function whatsNextTemplates(language: string): WhatsNextTemplates {
  return isChinese(language)
    ? TEMPLATE_REGISTRY["zh-CN"]
    : TEMPLATE_REGISTRY["en-US"];
}
