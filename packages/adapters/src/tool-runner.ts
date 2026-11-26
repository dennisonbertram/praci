import { createHash } from "node:crypto";
import { getQuickJS, shouldInterruptAfterDeadline } from "quickjs-emscripten";

/**
 * Runs a bot-written tool in a QuickJS WebAssembly interpreter. This is the sandbox for an
 * approved tool that runs without a card, so it is deliberately bare: a fresh runtime per call, no
 * host functions, no module loader, no file system, network, timers or environment. The only
 * things that cross the boundary are the input (a JSON string) and the result (a JSON string).
 */
export const TOOL_LIMITS = {
  /** Wall-clock deadline for one call. */
  deadlineMs: 2000,
  memoryBytes: 32 * 1024 * 1024,
  stackBytes: 256 * 1024,
  maxInputChars: 1_000_000,
  maxOutputChars: 256 * 1024,
  maxSourceChars: 64 * 1024,
} as const;

export type ToolRunResult = { result: unknown } | { error: string };

export function toolSourceHash(source: string): string {
  return createHash("sha256").update(source, "utf8").digest("hex");
}

// Runs inside the VM after the tool's own source. `run` must be a plain synchronous function.
const ENTRY = `;(function () {
  if (typeof run !== "function") throw new Error("The tool must define function run(input).");
  var out = run(JSON.parse(__toolInput));
  if (out && typeof out.then === "function") throw new Error("run(input) must not be async.");
  var text = JSON.stringify(out);
  if (typeof text !== "string") throw new Error("run(input) must return JSON-compatible data.");
  return text;
})()`;

function message(value: unknown): string {
  const text =
    value && typeof value === "object" && "message" in value
      ? String((value as { message: unknown }).message)
      : String(value);
  return text.slice(0, 300) || "The tool failed.";
}

export async function runTool(
  source: string,
  input: unknown,
  limits: Partial<typeof TOOL_LIMITS> = {},
): Promise<ToolRunResult> {
  const max = { ...TOOL_LIMITS, ...limits };
  if (source.length > max.maxSourceChars) return { error: "The tool source is too large." };
  let inputJson: string | undefined;
  try {
    inputJson = JSON.stringify(input ?? {});
  } catch {
    return { error: "The input is not JSON." };
  }
  if (typeof inputJson !== "string" || inputJson.length > max.maxInputChars) {
    return { error: "The input is too large." };
  }

  const quickjs = await getQuickJS();
  const runtime = quickjs.newRuntime();
  const context = runtime.newContext();
  try {
    runtime.setMemoryLimit(max.memoryBytes);
    runtime.setMaxStackSize(max.stackBytes);
    runtime.setInterruptHandler(shouldInterruptAfterDeadline(Date.now() + max.deadlineMs));
    const inputHandle = context.newString(inputJson);
    context.setProp(context.global, "__toolInput", inputHandle);
    inputHandle.dispose();

    const evaluated = context.evalCode(`${source}\n${ENTRY}`, "tool.js");
    if (evaluated.error) {
      const error = context.dump(evaluated.error);
      evaluated.error.dispose();
      return { error: message(error) };
    }
    try {
      if (context.typeof(evaluated.value) !== "string") {
        return { error: "run(input) must return JSON-compatible data." };
      }
      const text = context.getString(evaluated.value);
      if (text.length > max.maxOutputChars) return { error: "The result is too large." };
      return { result: JSON.parse(text) };
    } finally {
      evaluated.value.dispose();
    }
  } catch (error) {
    return { error: message(error) };
  } finally {
    context.dispose();
    runtime.dispose();
  }
}
