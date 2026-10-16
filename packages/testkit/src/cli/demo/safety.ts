/**
 * The demo stack must never reach real services or other people's processes. These helpers build
 * the child environment from an allowlist and decide whether a Docker container is the demo's.
 */

const ALLOWED_PARENT_NAMES = new Set([
  "PATH",
  "HOME",
  "USER",
  "LOGNAME",
  "SHELL",
  "TMPDIR",
  "LANG",
  "TERM",
  "COREPACK_HOME",
  "OPENROUTER_API_KEY",
  "ANTHROPIC_API_KEY",
]);
const ALLOWED_PARENT_PREFIXES = ["LC_", "NODE", "PNPM_", "npm_", "COREPACK_"];

/** The parent variables a demo child may inherit: the toolchain and the model-provider keys only. */
export function childEnv(parent: NodeJS.ProcessEnv, own: NodeJS.ProcessEnv): NodeJS.ProcessEnv {
  const kept = Object.entries(parent).filter(
    ([name]) =>
      ALLOWED_PARENT_NAMES.has(name) || ALLOWED_PARENT_PREFIXES.some((p) => name.startsWith(p)),
  );
  return { ...Object.fromEntries(kept), ...own };
}

export const DEMO_LABEL = "rakazo.demo";

export interface ContainerInfo {
  id: string;
  labels: Record<string, string> | null;
}

/** Throws unless the named container is the demo's own: labeled, and the one recorded at start. */
export function assertDemoContainer(info: ContainerInfo | null, recordedId?: string): void {
  if (!info) return;
  if (info.labels?.[DEMO_LABEL] !== "1")
    throw new Error(
      "A container named rakazo-demo-pg exists without the rakazo.demo label; refusing to touch it. Remove or rename it yourself.",
    );
  if (recordedId && info.id !== recordedId)
    throw new Error(
      "The rakazo-demo-pg container is not the one this demo started; refusing to remove it.",
    );
}
