import { execFile as nodeExecFile } from "node:child_process";
import { accessSync, constants } from "node:fs";
import { homedir } from "node:os";
import path from "node:path";
import type { HexMeetingList, HexMeetingShow, HexResult } from "@rakazo/contracts";
import { HexMeetingListSchema, HexMeetingShowSchema } from "@rakazo/contracts";

/**
 * Runs Hex's read-only transcript commands (`meetings list|show --json`, contract version 1) for the
 * renderer. Only two absolute paths are tried, never PATH, the argument list is built here from a
 * number and a regex-checked id, and output is capped and schema-checked before it leaves main.
 */

const ID = /^[0-9]+-[0-9]+$/;
const TIMEOUT_MS = 15_000;
const MAX_OUTPUT_BYTES = 4 * 1024 * 1024;

export const hexCandidates = (home: string) => [
  "/Applications/Hex.app/Contents/MacOS/hex",
  path.join(home, "Applications/Hex.app/Contents/MacOS/hex"),
];

type Exec = (
  file: string,
  args: string[],
  options: {
    timeout: number;
    maxBuffer: number;
    shell: false;
    env: Record<string, string>;
  },
  done: (error: Error | null, stdout: string, stderr: string) => void,
) => unknown;

const executable = (file: string) => {
  try {
    accessSync(file, constants.X_OK);
    return true;
  } catch {
    return false;
  }
};

/** The first candidate that is an executable file. Never searches PATH. */
export const findHex = (candidates = hexCandidates(homedir()), exists = executable) =>
  candidates.find(exists);

export function createHexRunner(
  options: {
    candidates?: string[];
    exists?: (file: string) => boolean;
    exec?: Exec;
    timeoutMs?: number;
    maxOutputBytes?: number;
  } = {},
) {
  const home = homedir();
  const candidates = options.candidates ?? hexCandidates(home);
  const exists = options.exists ?? executable;
  const exec = options.exec ?? (nodeExecFile as unknown as Exec);
  const find = () => findHex(candidates, exists);

  async function run<T>(
    args: string[],
    schema: {
      safeParse: (value: unknown) => { success: true; data: T } | { success: false };
    },
  ): Promise<HexResult<T>> {
    const file = find();
    if (!file) return { state: "not_found" };
    const stdout = await new Promise<string | null>((resolve) => {
      // stderr is dropped: it is never shown to the renderer or logged.
      exec(
        file,
        args,
        {
          timeout: options.timeoutMs ?? TIMEOUT_MS,
          maxBuffer: options.maxOutputBytes ?? MAX_OUTPUT_BYTES,
          shell: false,
          env: { HOME: home },
        },
        (error, out) => resolve(error ? null : out),
      );
    });
    if (stdout === null) return { state: "failed" };
    let json: unknown;
    try {
      json = JSON.parse(stdout);
    } catch {
      return { state: "failed" };
    }
    const parsed = schema.safeParse(json);
    // Another version, or a shape the version 1 contract does not describe.
    return parsed.success ? { state: "ok", value: parsed.data } : { state: "update" };
  }

  return {
    available: async () => find() !== undefined,
    list(sinceMs: number): Promise<HexResult<HexMeetingList>> {
      if (!Number.isFinite(sinceMs) || sinceMs < 0 || sinceMs > 8.64e15)
        return Promise.resolve({ state: "failed" });
      return run(
        ["meetings", "list", "--since", new Date(sinceMs).toISOString(), "--json"],
        HexMeetingListSchema,
      );
    },
    show(id: string): Promise<HexResult<HexMeetingShow>> {
      if (typeof id !== "string" || !ID.test(id)) return Promise.resolve({ state: "failed" });
      return run(["meetings", "show", id, "--json"], HexMeetingShowSchema);
    },
  };
}
