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
export const SLOT_LABEL = "rakazo.demo.slot";

/** Ports and container name for a demo slot (0-9), so several stacks can run side by side. */
export function slotConfig(raw: string | undefined) {
  const slot = raw === undefined || raw === "" ? 0 : Number(raw);
  if (!Number.isInteger(slot) || slot < 0 || slot > 9)
    throw new Error(`DEMO_SLOT must be an integer from 0 to 9; got "${raw}".`);
  return {
    slot,
    pgPort: 5450 + slot,
    apiPort: 3300 + slot,
    webPort: 5373 + slot,
    container: slot === 0 ? "rakazo-demo-pg" : `rakazo-demo-pg-${slot}`,
  };
}

export interface ContainerInfo {
  id: string;
  labels: Record<string, string> | null;
}

/** Throws unless the container is this slot's own: labeled, same slot, and the one recorded at start. */
export function assertDemoContainer(
  info: ContainerInfo | null,
  recordedId?: string,
  slot = 0,
): void {
  if (!info) return;
  const { container } = slotConfig(String(slot));
  if (info.labels?.[DEMO_LABEL] !== "1")
    throw new Error(
      `A container named ${container} exists without the rakazo.demo label; refusing to touch it. Remove or rename it yourself.`,
    );
  // A container made before slots existed has no slot label and is slot 0.
  if ((info.labels?.[SLOT_LABEL] ?? "0") !== String(slot))
    throw new Error(
      `The ${container} container belongs to a different demo slot; refusing to remove it.`,
    );
  if (recordedId && info.id !== recordedId)
    throw new Error(
      `The ${container} container is not the one this demo started; refusing to remove it.`,
    );
}
