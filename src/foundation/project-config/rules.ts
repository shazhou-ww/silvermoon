import { isCanonicalLanguageTag } from "../language/index.ts";
import { CONFIG_PATH } from "../coordinates/index.ts";
import { validBranchName, validRepository } from "../coordinates/index.ts";
import { parseStrictYaml, stringifyCanonicalYaml } from "../schema/index.ts";

const CONFIG_KEYS = [
  "version",
  "primaryRepository",
  "primaryBranch",
  "preferredLanguage",
];

export interface ConfigDiagnostic {
  code: string | undefined;
  level: "error";
  path: string;
  message: string;
  remediation: string;
}

export interface ProjectConfig {
  version: 1 | 2;
  primaryRepository: string;
  primaryBranch: string;
  preferredLanguage?: string;
}

interface ConfigSource {
  absolutePath: string;
  root: string;
  source: string;
}

/** @pure */
function isMapping(value: unknown): value is Record<string, unknown> {
  return value !== null && !Array.isArray(value) && typeof value === "object";
}

/** @pure */
export function configDiagnostic(
  code: string | undefined,
  path: string,
  message: string,
  remediation: string,
): ConfigDiagnostic {
  return { code, level: "error", path, message, remediation };
}

/** @pure */
export function validPrimaryBranch(_root: unknown, value: unknown) {
  return validBranchName(value);
}

/** @pure */
export function serializeConfig(config: ProjectConfig) {
  const canonical = {
    version: config.version,
    primaryRepository: config.primaryRepository,
    primaryBranch: config.primaryBranch,
    ...(config.preferredLanguage === undefined
      ? {}
      : { preferredLanguage: config.preferredLanguage }),
  };
  return stringifyCanonicalYaml(canonical);
}

/** @pure */
export function parseConfigSource({ absolutePath, root, source }: ConfigSource) {
  const normalizedSource = source.replaceAll("\r\n", "\n");
  let value: unknown;
  try {
    value = parseStrictYaml(normalizedSource);
  } catch (caught) {
    return {
      config: null,
      configPath: absolutePath,
      diagnostics: [configDiagnostic(
        "config.invalid-yaml",
        CONFIG_PATH,
        `Cannot parse Silvermoon configuration: ${
          caught instanceof Error ? caught.message : String(caught)
        }`,
        `Use the strict YAML contract in ${CONFIG_PATH}.`,
      )],
    };
  }

  if (!isMapping(value)) {
    return {
      config: null,
      configPath: absolutePath,
      diagnostics: [configDiagnostic(
        "config.invalid-type",
        CONFIG_PATH,
        "The Silvermoon configuration must be a YAML mapping.",
        `Replace ${CONFIG_PATH} with the documented mapping.`,
      )],
    };
  }

  const diagnostics: ConfigDiagnostic[] = [];
  for (const key of Object.keys(value).sort()) {
    if (!CONFIG_KEYS.includes(key)) {
      diagnostics.push(configDiagnostic(
        "config.unknown-key",
        `${CONFIG_PATH}#${key}`,
        `Unknown Silvermoon configuration key: ${key}`,
        `Remove ${key}.`,
      ));
    }
  }
  const requiredKeys = [
    { key: "version", code: "config.missing-version" },
    {
      key: "primaryRepository",
      code: "config.missing-primary-repository",
    },
    { key: "primaryBranch", code: "config.missing-primary-branch" },
  ];
  for (const { key, code } of requiredKeys) {
    if (!Object.hasOwn(value, key)) {
      diagnostics.push(configDiagnostic(
        code,
        `${CONFIG_PATH}#${key}`,
        `Missing required key: ${key}`,
        `Add ${key} to ${CONFIG_PATH}.`,
      ));
    }
  }
  if (
    Object.hasOwn(value, "version")
    && value.version !== 1
    && value.version !== 2
  ) {
    diagnostics.push(configDiagnostic(
      "config.unsupported-version",
      `${CONFIG_PATH}#version`,
      `Unsupported Silvermoon version: ${String(value.version)}`,
      "Use version: 1 or 2; migrate existing v1 projects explicitly.",
    ));
  }
  if (
    Object.hasOwn(value, "primaryRepository") &&
    (typeof value.primaryRepository !== "string"
      || !validRepository(value.primaryRepository))
  ) {
    diagnostics.push(configDiagnostic(
      "config.invalid-primary-repository",
      `${CONFIG_PATH}#primaryRepository`,
      "primaryRepository must be a canonical credential-free HTTPS repository URL.",
      "Use a canonical HTTPS repository URL without credentials, query, fragment, or trailing slash.",
    ));
  }
  if (
    Object.hasOwn(value, "primaryBranch") &&
    !validPrimaryBranch(root, value.primaryBranch)
  ) {
    diagnostics.push(configDiagnostic(
      "config.invalid-primary-branch",
      `${CONFIG_PATH}#primaryBranch`,
      "primaryBranch must be a valid short Git branch name.",
      "Use a branch such as main without refs/ or remote prefixes.",
    ));
  }
  if (
    Object.hasOwn(value, "preferredLanguage") &&
    (typeof value.preferredLanguage !== "string"
      || !isCanonicalLanguageTag(value.preferredLanguage))
  ) {
    diagnostics.push(configDiagnostic(
      "config.invalid-preferred-language",
      `${CONFIG_PATH}#preferredLanguage`,
      "preferredLanguage must be a canonical BCP 47 language tag.",
      "Use a canonical tag such as en or zh-CN.",
    ));
  }
  const config: ProjectConfig | null = diagnostics.length === 0
    && (value.version === 1 || value.version === 2)
    && typeof value.primaryRepository === "string"
    && typeof value.primaryBranch === "string"
    && (
      value.preferredLanguage === undefined
      || typeof value.preferredLanguage === "string"
    )
    ? {
        version: value.version,
        primaryRepository: value.primaryRepository,
        primaryBranch: value.primaryBranch,
        ...(value.preferredLanguage === undefined
          ? {}
          : { preferredLanguage: value.preferredLanguage }),
      }
    : null;
  if (
    config !== null
    && serializeConfig(config) !== normalizedSource
  ) {
    diagnostics.push(configDiagnostic(
      "config.noncanonical",
      CONFIG_PATH,
      "The Silvermoon configuration is valid but not canonical.",
      "Rewrite properties in version, primaryRepository, primaryBranch, preferredLanguage order with LF endings.",
    ));
  }

  return {
    config: diagnostics.length === 0 ? config : null,
    configPath: absolutePath,
    diagnostics,
  };
}
