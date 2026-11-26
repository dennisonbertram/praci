/**
 * The input schema of a bot-built tool. The repo has no JSON Schema validator, so this is a small
 * fixed subset that fails closed: any keyword outside it is rejected when the schema is saved.
 * Supported: type (string, number, integer, boolean, array, object), properties, required, items,
 * enum, description. Extra properties on an object are allowed. The root must be an object.
 */
const TYPES = new Set(["string", "number", "integer", "boolean", "array", "object"]);
const KEYWORDS = new Set(["type", "properties", "required", "items", "enum", "description"]);
const MAX_DEPTH = 6;
const MAX_ENUM = 100;

type Node = {
  type: string;
  properties?: Record<string, Node>;
  required?: string[];
  items?: Node;
  enum?: unknown[];
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

function checkNode(node: unknown, path: string, depth: number): string | undefined {
  if (depth > MAX_DEPTH) return `${path}: nested too deeply.`;
  if (!isRecord(node)) return `${path}: must be an object.`;
  for (const key of Object.keys(node)) {
    if (!KEYWORDS.has(key)) return `${path}: "${key}" is not supported.`;
  }
  if (typeof node.type !== "string" || !TYPES.has(node.type)) {
    return `${path}: type must be string, number, integer, boolean, array or object.`;
  }
  if (node.properties !== undefined) {
    if (node.type !== "object" || !isRecord(node.properties)) {
      return `${path}: properties only applies to an object.`;
    }
    for (const [key, child] of Object.entries(node.properties)) {
      const bad = checkNode(child, `${path}.${key}`, depth + 1);
      if (bad) return bad;
    }
  }
  if (node.required !== undefined) {
    if (
      node.type !== "object" ||
      !Array.isArray(node.required) ||
      !node.required.every((key) => typeof key === "string")
    ) {
      return `${path}: required must be a list of property names on an object.`;
    }
  }
  if (node.items !== undefined) {
    if (node.type !== "array") return `${path}: items only applies to an array.`;
    const bad = checkNode(node.items, `${path}[]`, depth + 1);
    if (bad) return bad;
  }
  if (node.enum !== undefined) {
    if (!Array.isArray(node.enum) || node.enum.length > MAX_ENUM) {
      return `${path}: enum must be a short list.`;
    }
  }
  return undefined;
}

/** Returns a message when the schema is not in the supported subset. */
export function validateToolInputSchema(schema: unknown): string | undefined {
  if (!isRecord(schema) || schema.type !== "object") return "The input schema must be an object.";
  return checkNode(schema, "input", 0);
}

function checkValue(node: Node, value: unknown, path: string): string | undefined {
  switch (node.type) {
    case "string":
      if (typeof value !== "string") return `${path} must be a string.`;
      break;
    case "number":
      if (typeof value !== "number" || !Number.isFinite(value)) return `${path} must be a number.`;
      break;
    case "integer":
      if (!Number.isInteger(value)) return `${path} must be an integer.`;
      break;
    case "boolean":
      if (typeof value !== "boolean") return `${path} must be true or false.`;
      break;
    case "array": {
      if (!Array.isArray(value)) return `${path} must be a list.`;
      if (node.items) {
        for (const [index, item] of value.entries()) {
          const bad = checkValue(node.items, item, `${path}[${index}]`);
          if (bad) return bad;
        }
      }
      break;
    }
    default: {
      if (!isRecord(value)) return `${path} must be an object.`;
      for (const key of node.required ?? []) {
        if (value[key] === undefined) return `${path}.${key} is required.`;
      }
      for (const [key, child] of Object.entries(node.properties ?? {})) {
        if (value[key] === undefined) continue;
        const bad = checkValue(child, value[key], `${path}.${key}`);
        if (bad) return bad;
      }
    }
  }
  if (node.enum && !node.enum.some((allowed) => allowed === value)) {
    return `${path} must be one of the allowed values.`;
  }
  return undefined;
}

/** Returns a message when `input` does not match a schema that passed validateToolInputSchema. */
export function validateToolInput(schema: unknown, input: unknown): string | undefined {
  if (validateToolInputSchema(schema)) return "The tool's input schema is invalid.";
  return checkValue(schema as Node, input, "input");
}
