import jsonata from "jsonata";
import type { ObjectiveSubject } from "./types.ts";
import { ObjectiveConfigurationError, json, record } from "./validation.ts";

export const SUBJECT_PROJECTION_LIMITS = Object.freeze({
  expressionBytes: 4096, depth: 32, nodes: 512, milliseconds: 25, outputBytes: 65536,
});
export class SubjectProjectionError extends TypeError {}

interface Node {
  type: string;
  value?: unknown;
  steps?: readonly Node[];
  lhs?: Node | readonly (readonly [Node, Node])[];
  rhs?: Node;
  expressions?: readonly Node[];
}

export function compileSubjectProjection(expression: string): (subject: ObjectiveSubject) => unknown {
  if (Buffer.byteLength(expression) > SUBJECT_PROJECTION_LIMITS.expressionBytes) {
    throw new ObjectiveConfigurationError("Subject projection exceeds expression limit.");
  }
  let raw: unknown;
  try {
    raw = JSON.parse(JSON.stringify(jsonata(expression).ast()));
  } catch (caught) {
    const message = record(caught) && typeof caught.message === "string" ? caught.message : String(caught);
    throw new ObjectiveConfigurationError(`Invalid JSONata projection: ${message}`, { cause: caught });
  }
  let nodes = 0;
  function parse(value: unknown, depth = 0): Node {
    if (++nodes > SUBJECT_PROJECTION_LIMITS.nodes || depth > SUBJECT_PROJECTION_LIMITS.depth
      || !record(value) || typeof value.type !== "string"
      || Object.keys(value).some((key) => !["type", "value", "position", "steps", "lhs", "rhs", "expressions"].includes(key))) {
      throw new ObjectiveConfigurationError("Unsupported or oversized JSONata AST.");
    }
    const child = (entry: unknown) => parse(entry, depth + 1);
    switch (value.type) {
      case "string": case "number": case "value":
        if (!json(value.value) || typeof value.value === "object") break;
        return { type: value.type, value: value.value };
      case "name":
        if (typeof value.value !== "string") break;
        return { type: "name", value: value.value };
      case "variable":
        if (value.value !== "") break;
        return { type: "variable" };
      case "path":
        if (!Array.isArray(value.steps) || value.steps.length === 0) break;
        return { type: "path", steps: value.steps.map(child) };
      case "unary":
        if (value.value === "{" && Array.isArray(value.lhs)) {
          const pairs: [Node, Node][] = value.lhs.map((pair: unknown) => {
            if (!Array.isArray(pair) || pair.length !== 2) throw new ObjectiveConfigurationError("Invalid object projection.");
            const key = child(pair[0]);
            if (key.type !== "string") throw new ObjectiveConfigurationError("Projection keys must be literal strings.");
            return [key, child(pair[1])];
          });
          return { type: "unary", value: "{", lhs: pairs };
        }
        if (value.value === "[" && Array.isArray(value.expressions)) {
          return { type: "unary", value: "[", expressions: value.expressions.map(child) };
        }
        break;
      case "binary":
        if (["+", "-", "*", "/", "%", "&"].includes(String(value.value))) {
          return { type: "binary", value: value.value, lhs: child(value.lhs), rhs: child(value.rhs) };
        }
    }
    throw new ObjectiveConfigurationError(`JSONata ${value.type} is outside the deterministic subject projection profile.`);
  }
  const ast = parse(raw);
  return (subject) => {
    const deadline = performance.now() + SUBJECT_PROJECTION_LIMITS.milliseconds;
    let steps = 0;
    function evaluate(node: Node, input: unknown): unknown {
      if (++steps > SUBJECT_PROJECTION_LIMITS.nodes * SUBJECT_PROJECTION_LIMITS.nodes || performance.now() > deadline) {
        throw new SubjectProjectionError("Subject projection exceeded execution limit.");
      }
      switch (node.type) {
        case "string": case "number": case "value": return node.value;
        case "variable": return input;
        case "name": return record(input) && Object.hasOwn(input, String(node.value)) ? input[String(node.value)] : undefined;
        case "path": {
          let result = input;
          for (const step of node.steps!) {
            if (Array.isArray(result)) {
              const values: unknown[] = result.flatMap((item) => {
                const value = evaluate(step, item);
                return value === undefined ? [] : Array.isArray(value) ? value : [value];
              });
              result = values.length === 0 ? undefined : values.length === 1 ? values[0] : values;
            } else result = evaluate(step, result);
          }
          return result;
        }
        case "unary": {
          if (node.value === "[") return node.expressions!.flatMap((entry) => {
            const value = evaluate(entry, input);
            return value === undefined ? [] : Array.isArray(value) && !(entry.type === "unary" && entry.value === "[") ? value : [value];
          });
          const result: Record<string, unknown> = {};
          const pairs = node.lhs;
          if (!Array.isArray(pairs)) throw new SubjectProjectionError("Invalid compiled projection.");
          for (const [key, value] of pairs) {
            const name = String(key.value);
            const entry = evaluate(value, input);
            if (Object.hasOwn(result, name)) throw new SubjectProjectionError(`Duplicate projected key: ${name}.`);
            if (entry !== undefined) Object.defineProperty(result, name, { enumerable: true, value: entry });
          }
          return result;
        }
        case "binary": {
          const lhs = node.lhs;
          if (lhs === undefined || Array.isArray(lhs)) throw new SubjectProjectionError("Invalid binary projection.");
          const left = evaluate(lhs as Node, input);
          const right = evaluate(node.rhs!, input);
          if (node.value === "&") {
            if (typeof left !== "string" || typeof right !== "string") throw new SubjectProjectionError("Concatenation requires strings.");
            return left + right;
          }
          if (typeof left !== "number" || typeof right !== "number") throw new SubjectProjectionError("Arithmetic requires numbers.");
          switch (node.value) {
            case "+": return left + right;
            case "-": return left - right;
            case "*": return left * right;
            case "/": return left / right;
            case "%": return left % right;
          }
        }
      }
      throw new SubjectProjectionError("Unsupported compiled projection.");
    }
    const result = evaluate(ast, subject);
    if (!json(result) || Buffer.byteLength(JSON.stringify(result)) > SUBJECT_PROJECTION_LIMITS.outputBytes
      || performance.now() > deadline) {
      throw new SubjectProjectionError("Projection must produce bounded, finite JSON.");
    }
    return result;
  };
}
