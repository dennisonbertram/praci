import { describe, expect, it } from "vitest";
import {
  deploymentPermissionDefault,
  effectivePermissionLevel,
  resolvePermissionLevel,
} from "./permission-level.js";

describe("deploymentPermissionDefault", () => {
  it("defaults to open and accepts only the three levels", () => {
    expect(deploymentPermissionDefault({})).toBe("open");
    expect(deploymentPermissionDefault({ RAKAZO_PERMISSIONS_DEFAULT: "" })).toBe("open");
    expect(deploymentPermissionDefault({ RAKAZO_PERMISSIONS_DEFAULT: "  " })).toBe("open");
    expect(
      deploymentPermissionDefault({
        RAKAZO_PERMISSIONS_DEFAULT: " Ask_Changes ",
      }),
    ).toBe("ask_changes");
    expect(
      deploymentPermissionDefault({
        RAKAZO_PERMISSIONS_DEFAULT: "ask_everything",
      }),
    ).toBe("ask_everything");
  });

  it("fails closed on a value that is not a level", () => {
    // A typo must never silently open the gate: the deployment keeps asking for changes.
    expect(deploymentPermissionDefault({ RAKAZO_PERMISSIONS_DEFAULT: "nonsense" })).toBe(
      "ask_changes",
    );
    expect(deploymentPermissionDefault({ RAKAZO_PERMISSIONS_DEFAULT: "ask" })).toBe("ask_changes");
  });
});

describe("effectivePermissionLevel", () => {
  const env = {};
  it("prefers the agent, then the space, then the deployment default", () => {
    expect(
      effectivePermissionLevel({
        botLevel: "ask_everything",
        spaceLevel: "open",
        env,
      }),
    ).toBe("ask_everything");
    expect(
      effectivePermissionLevel({
        botLevel: null,
        spaceLevel: "ask_changes",
        env,
      }),
    ).toBe("ask_changes");
    expect(effectivePermissionLevel({ env })).toBe("open");
    expect(
      effectivePermissionLevel({
        env: { RAKAZO_PERMISSIONS_DEFAULT: "ask_changes" },
      }),
    ).toBe("ask_changes");
  });

  it("ignores a stored value that is not a level", () => {
    expect(
      effectivePermissionLevel({
        botLevel: "bogus",
        spaceLevel: "ask_changes",
        env,
      }),
    ).toBe("ask_changes");
  });

  it("never gives a firewalled or external agent open, from any source", () => {
    for (const restricted of [{ firewall: true }, { external: true }]) {
      expect(effectivePermissionLevel({ botLevel: "open", env, ...restricted })).toBe(
        "ask_changes",
      );
      expect(effectivePermissionLevel({ spaceLevel: "open", env, ...restricted })).toBe(
        "ask_changes",
      );
      expect(effectivePermissionLevel({ env, ...restricted })).toBe("ask_changes");
      expect(
        effectivePermissionLevel({
          botLevel: "ask_everything",
          env,
          ...restricted,
        }),
      ).toBe("ask_everything");
    }
  });
});

describe("resolvePermissionLevel", () => {
  it("uses stored levels when metadata loads successfully", async () => {
    await expect(
      resolvePermissionLevel(async () => ({
        spaceLevel: "open",
        env: { RAKAZO_PERMISSIONS_DEFAULT: "ask_changes" },
      })),
    ).resolves.toBe("open");
  });

  it("requires approval for everything when permission metadata cannot be read", async () => {
    await expect(
      resolvePermissionLevel(async () => {
        throw new Error("metadata unavailable");
      }),
    ).resolves.toBe("ask_everything");
  });
});
