import type { ElementNode } from "@openuidev/lang-core";
import { createLibrary, createParser, defineComponent } from "@openuidev/lang-core";
import * as z from "zod";
import type { UiBlock, UiBlockType } from "./vocabulary.js";
import { blockShapes, chartSeriesSchema, LAYOUT_TYPES, UI_LIMITS } from "./vocabulary.js";

/**
 * The only file that knows about OpenUI. Only the core parser is used. Nothing here registers
 * a tool, a query, a state variable or an action, so a stored artifact can only describe content.
 */

const shapes = blockShapes(z.any());
const NAMES = {
  heading: "Heading",
  text: "Text",
  metric: "Metric",
  table: "Table",
  list: "List",
  badge: "Badge",
  divider: "Divider",
  chart: "Chart",
  card: "Card",
  stack: "Stack",
  grid: "Grid",
} as const satisfies Record<UiBlockType, string>;

const TYPE_BY_NAME = new Map<string, UiBlockType>(
  (Object.keys(NAMES) as UiBlockType[]).map((type) => [NAMES[type], type]),
);

/** Property names of each block type, in positional-argument order, without `type`. */
const PROPS = Object.fromEntries(
  (Object.keys(shapes) as UiBlockType[]).map((type) => [
    type,
    Object.keys(shapes[type].shape).filter((key) => key !== "type"),
  ]),
) as Record<UiBlockType, string[]>;

const Series = defineComponent({
  name: "Series",
  description: "One named line or bar series of a Chart",
  props: chartSeriesSchema,
  component: null,
});

function component(type: UiBlockType) {
  const { type: _type, ...rest } = shapes[type].shape;
  const props =
    type === "chart"
      ? z.object({ ...rest, series: z.array(Series.ref).min(1).max(UI_LIMITS.chartSeries) })
      : z.object(rest);
  return defineComponent({ name: NAMES[type], description: type, props, component: null });
}

const library = createLibrary({
  components: [Series, ...(Object.keys(NAMES) as UiBlockType[]).map(component)],
  root: "Stack",
});
const parser = createParser(library.toJSONSchema());

// ---- blocks to OpenUI Lang ----

function value(v: unknown): string {
  if (Array.isArray(v)) return `[${v.map(value).join(", ")}]`;
  if (v && typeof v === "object") {
    const o = v as Record<string, unknown>;
    // A chart series
    return `Series(${value(o.name)}, ${value(o.values)})`;
  }
  if (v === undefined || v === null) return "null";
  if (typeof v === "number") return Number.isFinite(v) ? String(v) : "null";
  return JSON.stringify(v);
}

function block(b: UiBlock): string {
  const record = b as unknown as Record<string, unknown>;
  const keys = PROPS[b.type];
  const args = keys.map((key) =>
    key === "children"
      ? `[${(b as { children: UiBlock[] }).children.map(block).join(", ")}]`
      : value(record[key]),
  );
  // Trailing optional arguments are left out; one in the middle is written as null.
  while (args.length && record[keys[args.length - 1] as string] === undefined) args.pop();
  return `${NAMES[b.type]}(${args.join(", ")})`;
}

/** OpenUI Lang for these blocks, one line, ready to store as the artifact. */
export function blocksToSource(blocks: readonly UiBlock[]): string {
  return `root = Stack([${blocks.map(block).join(", ")}])`;
}

// ---- OpenUI Lang to blocks ----

export type ParsedUiArtifact = {
  blocks: UiBlock[];
  /** What was dropped or refused. Empty when everything parsed as written. */
  problems: string[];
};

/** Brackets and parentheses open at once, ignoring text inside strings. */
function nesting(source: string): number {
  let depth = 0;
  let max = 0;
  let inString = false;
  for (let i = 0; i < source.length; i++) {
    const ch = source[i];
    if (inString) {
      if (ch === "\\") i += 1;
      else if (ch === '"') inString = false;
    } else if (ch === '"') inString = true;
    else if (ch === "(" || ch === "[" || ch === "{") max = Math.max(max, ++depth);
    else if (ch === ")" || ch === "]" || ch === "}") depth -= 1;
  }
  return max;
}

const clean = (props: Record<string, unknown>) =>
  Object.fromEntries(Object.entries(props).filter(([, v]) => v !== null && v !== undefined));

/**
 * Parses stored OpenUI Lang into blocks. Anything outside the vocabulary or its limits is dropped
 * and listed in `problems`, so the viewer shows the rest. Never throws.
 */
export function parseSource(source: string): ParsedUiArtifact {
  const problems: string[] = [];
  if (source.length > UI_LIMITS.sourceChars) {
    return {
      blocks: [],
      problems: [`The source is longer than ${UI_LIMITS.sourceChars} characters`],
    };
  }
  if (nesting(source) > 4 * (UI_LIMITS.depth + 2)) {
    return { blocks: [], problems: ["The source is nested too deeply"] };
  }
  let result: ReturnType<typeof parser.parse>;
  try {
    result = parser.parse(source);
  } catch {
    return { blocks: [], problems: ["The source could not be parsed"] };
  }
  for (const error of result.meta.errors) problems.push(error.message);
  if (result.meta.unresolved.length)
    problems.push(`Unknown names: ${result.meta.unresolved.join(", ")}`);
  if (result.meta.incomplete) problems.push("The source ends early");
  if (result.stateDeclarations && Object.keys(result.stateDeclarations).length)
    problems.push("State variables are not supported");
  if (result.queryStatements.length || result.mutationStatements.length)
    problems.push("Queries and mutations are not supported");

  let budget = UI_LIMITS.blocks;
  const convert = (el: unknown, depth: number): UiBlock | null => {
    if (!el || typeof el !== "object" || (el as ElementNode).type !== "element") {
      problems.push("A value is not a component");
      return null;
    }
    const node = el as ElementNode;
    const type = TYPE_BY_NAME.get(node.typeName);
    if (!type) {
      problems.push(`Unknown component ${node.typeName}`);
      return null;
    }
    const layout = (LAYOUT_TYPES as readonly string[]).includes(type);
    if (layout && depth > UI_LIMITS.depth + 1) {
      problems.push("Layouts are nested too deeply");
      return null;
    }
    if (budget <= 0) {
      problems.push(`More than ${UI_LIMITS.blocks} blocks`);
      return null;
    }
    budget -= 1;
    const props = clean(node.props);
    if (layout) {
      const raw = Array.isArray(props.children) ? props.children : [];
      props.children = raw
        .map((child) => convert(child, depth + 1))
        .filter((child): child is UiBlock => child !== null);
    }
    if (type === "chart" && Array.isArray(props.series)) {
      props.series = props.series.map((s) => clean((s as ElementNode).props ?? {}));
    }
    const checked = shapes[type].safeParse({ type, ...props });
    if (!checked.success) {
      problems.push(`${NAMES[type]}: ${checked.error.issues[0]?.message ?? "invalid"}`);
      return null;
    }
    return checked.data as UiBlock;
  };

  const root = result.root ? convert(result.root, 1) : null; // the root Stack is level 1
  if (!root) return { blocks: [], problems: problems.length ? problems : ["The source is empty"] };
  // The generated root is a Stack; show its children directly.
  const blocks = root.type === "stack" ? root.children : [root];
  return { blocks, problems };
}
