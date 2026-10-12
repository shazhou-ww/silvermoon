import { parseStrictYaml } from "../foundation/schema/index.ts";

export type Target = Readonly<Record<string, unknown>>;

export interface Problem {
  code: string;
  description: string;
}

export interface Observation {
  level: number;
  problems: readonly Problem[];
}

export interface LevelDefinition {
  level: number;
  description: string;
}

export interface ProfessionalModel {
  observe(target: Target): Promise<Observation>;
  guide(code: string): string;
  describe(): readonly LevelDefinition[];
}

export type CheckResult =
  | { passed: true }
  | { passed: false; problems: readonly [Problem, ...Problem[]] };
export type AtomicCheck = (target: Target) => Promise<CheckResult>;
export type CheckRegistry = Readonly<Record<string, AtomicCheck>>;

export class ConfigurationError extends TypeError {}
export class TargetError extends TypeError {}

function record(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null
    && !Array.isArray(value)
    && (Object.getPrototypeOf(value) === Object.prototype
      || Object.getPrototypeOf(value) === null);
}

function text(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function exactKeys(value: Record<string, unknown>, keys: readonly string[]) {
  if (Object.keys(value).some((key) => !keys.includes(key))
    || keys.some((key) => !Object.hasOwn(value, key))) {
    throw new ConfigurationError(`Expected configuration fields: ${keys.join(", ")}.`);
  }
}

function stringMap(value: unknown, name: string): Record<string, string> {
  if (!record(value) || Object.entries(value).some(([key, entry]) => !text(key) || !text(entry))) {
    throw new ConfigurationError(`${name} must map non-empty names to non-empty strings.`);
  }
  return Object.fromEntries(Object.entries(value).map(([key, entry]) => [key, String(entry)]));
}

const FIELD_TYPES = new Set(["string", "number", "boolean"]);

/** YAML contains references only; the registry factory owns observation-local state. */
export function assembleProfessionalModel(
  source: string,
  createChecks: () => CheckRegistry,
): ProfessionalModel {
  let config: unknown;
  try {
    config = parseStrictYaml(source);
  } catch (caught) {
    if (!(caught instanceof Error)) throw caught;
    throw new ConfigurationError(`Invalid professional model YAML: ${caught.message}`, { cause: caught });
  }
  if (!record(config)) throw new ConfigurationError("Professional model must be an object.");
  exactKeys(config, ["levels", "checks", "target", "skills", "guidance", "unknown"]);
  const targetFields = stringMap(config.target, "target");
  for (const type of Object.values(targetFields)) {
    if (!FIELD_TYPES.has(type.replace(/^optional-/, ""))) {
      throw new ConfigurationError(`Unsupported target field type: ${type}.`);
    }
  }
  if (!Array.isArray(config.levels) || config.levels.length === 0) {
    throw new ConfigurationError("levels must be non-empty, starting at zero.");
  }
  const levels = Object.freeze(config.levels.map((entry: unknown, index: number) => {
    if (!record(entry)) throw new ConfigurationError(`Invalid level ${index}.`);
    exactKeys(entry, ["level", "description"]);
    if (entry.level !== index || !text(entry.description)) {
      throw new ConfigurationError("Levels must be consecutive non-negative integers with descriptions.");
    }
    return Object.freeze({ level: index, description: entry.description });
  }));
  if (!Array.isArray(config.checks) || config.checks.length !== levels.length - 1) {
    throw new ConfigurationError("checks must contain one group per level transition.");
  }
  const groups = config.checks.map((group: unknown) => {
    if (!Array.isArray(group) || group.some((name: unknown) => !text(name))) {
      throw new ConfigurationError("Each check group must contain non-empty registry names.");
    }
    return group.map((name: string) => name);
  });
  const skills = stringMap(config.skills, "skills");
  const guidance = stringMap(config.guidance, "guidance");
  if (!text(config.unknown) || !Object.hasOwn(skills, config.unknown)
    || Object.values(guidance).some((skill) => !Object.hasOwn(skills, skill))) {
    throw new ConfigurationError("Every guidance reference and unknown fallback must name a registered skill.");
  }
  const fallback = skills[config.unknown]!;

  return {
    describe: () => levels,
    guide: (code) => {
      const skill = Object.hasOwn(guidance, code) ? guidance[code] : undefined;
      return skill === undefined
        ? `Unknown problem code ${JSON.stringify(code)}; professional guidance is missing. ${fallback}`
        : skills[skill]!;
    },
    async observe(target) {
      if (!record(target)) throw new TargetError("Target must be a key-value object.");
      for (const [field, declaration] of Object.entries(targetFields)) {
        const optional = declaration.startsWith("optional-");
        const type = declaration.replace(/^optional-/, "");
        if (optional && (!Object.hasOwn(target, field) || target[field] === undefined)) continue;
        if (!Object.hasOwn(target, field) || typeof target[field] !== type
          || (type === "number" && !Number.isFinite(target[field]))) {
          throw new TargetError(`Target field ${field} must be ${declaration}.`);
        }
      }
      const checks = createChecks();
      if (!record(checks)) throw new ConfigurationError("Check registry must be a key-value object.");
      for (const name of groups.flat()) {
        if (!Object.hasOwn(checks, name) || typeof checks[name] !== "function") {
          throw new ConfigurationError(`Unknown registered check: ${name}.`);
        }
      }
      let level = 0;
      for (const group of groups) {
        for (const name of group) {
          const result = await checks[name]!(target);
          if (!record(result) || typeof result.passed !== "boolean") {
            throw new TypeError(`Check ${name} returned an invalid result.`);
          }
          if (result.passed && Object.hasOwn(result, "problems")) {
            throw new TypeError(`Passed check ${name} must not return problems.`);
          }
          if (!result.passed) {
            if (!Array.isArray(result.problems) || result.problems.length === 0
              || result.problems.some((problem: unknown) =>
                !record(problem) || !text(problem.code) || !text(problem.description))) {
              throw new TypeError(`Failed check ${name} must return non-empty problems.`);
            }
            return {
              level,
              problems: result.problems.map((problem: Problem) => ({
                code: problem.code, description: problem.description,
              })),
            };
          }
        }
        level += 1;
      }
      return { level, problems: [] };
    },
  };
}
