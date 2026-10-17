import { describe, expect, it } from "vitest";
import {
  assertDemoContainer,
  assertStateSlot,
  childEnv,
  demoModelEnv,
  slotConfig,
  stateDir,
} from "./safety.js";

describe("demo safety", () => {
  it("keeps real-service credentials out of the child environment", () => {
    const polluted = {
      PATH: "/bin",
      HOME: "/home/x",
      NODE_OPTIONS: "--x",
      PNPM_HOME: "/p",
      OPENROUTER_API_KEY: "k",
      RAKAZO_S3_BUCKET: "b",
      TELEGRAM_BOT_TOKEN: "t",
      SLACK_BOT_TOKEN: "s",
      SMTP_URL: "smtp://x",
      STRIPE_SECRET_KEY: "sk",
      DATABASE_URL: "postgres://real",
    };
    const env = childEnv(polluted, { DATABASE_URL: "postgres://demo" });
    expect(Object.keys(env).sort()).toEqual(
      ["DATABASE_URL", "HOME", "NODE_OPTIONS", "OPENROUTER_API_KEY", "PATH", "PNPM_HOME"].sort(),
    );
    expect(env.DATABASE_URL).toBe("postgres://demo");
  });

  it("only removes a labeled container that is the recorded one", () => {
    expect(() => assertDemoContainer(null)).not.toThrow();
    expect(() =>
      assertDemoContainer({ id: "a", labels: { "rakazo.demo": "1" } }, "a"),
    ).not.toThrow();
    expect(() => assertDemoContainer({ id: "a", labels: null })).toThrow(
      /without the rakazo.demo label/,
    );
    expect(() => assertDemoContainer({ id: "b", labels: { "rakazo.demo": "1" } }, "a")).toThrow(
      /not the one/,
    );
  });

  it("derives ports and container name from the slot", () => {
    expect(slotConfig(undefined)).toEqual({
      slot: 0,
      pgPort: 5450,
      apiPort: 3300,
      webPort: 5373,
      container: "rakazo-demo-pg",
    });
    expect(slotConfig("9")).toEqual({
      slot: 9,
      pgPort: 5459,
      apiPort: 3309,
      webPort: 5382,
      container: "rakazo-demo-pg-9",
    });
  });

  it("rejects an invalid slot", () => {
    for (const bad of ["10", "-1", "1.5", "abc"])
      expect(() => slotConfig(bad)).toThrow(/DEMO_SLOT/);
  });

  it("refuses a container that belongs to a different slot", () => {
    const slot3 = { id: "a", labels: { "rakazo.demo": "1", "rakazo.demo.slot": "3" } };
    expect(() => assertDemoContainer(slot3, "a", 3)).not.toThrow();
    expect(() => assertDemoContainer(slot3, "a", 0)).toThrow(/different demo slot/);
    expect(() => assertDemoContainer({ id: "a", labels: { "rakazo.demo": "1" } }, "a", 3)).toThrow(
      /different demo slot/,
    );
    // A pre-slot container (no slot label) is slot 0.
    expect(() =>
      assertDemoContainer({ id: "a", labels: { "rakazo.demo": "1" } }, "a"),
    ).not.toThrow();
  });

  it("keeps each slot's state apart and refuses another slot's state", () => {
    expect(stateDir("/r", 0)).toBe("/r/.demo");
    expect(stateDir("/r", 2)).toBe("/r/.demo/slot-2");
    expect(() => assertStateSlot(null, 2)).not.toThrow();
    expect(() => assertStateSlot({ slot: 2 }, 2)).not.toThrow();
    expect(() => assertStateSlot({}, 0)).not.toThrow();
    expect(() => assertStateSlot({ slot: 2 }, 0)).toThrow(/slot 2, not slot 0/);
    expect(() => assertStateSlot({}, 2)).toThrow(/slot 0, not slot 2/);
  });

  it("seeds a no-model state on request, and otherwise uses the keys it found", () => {
    expect(demoModelEnv({ OPENROUTER_API_KEY: "k" }, true)).toEqual({
      OPENROUTER_API_KEY: "",
      ANTHROPIC_API_KEY: "",
      AGENT_RUNTIME: "pi",
    });
    expect(demoModelEnv({ OPENROUTER_API_KEY: "k" }, false)).toEqual({
      OPENROUTER_API_KEY: "k",
      AGENT_RUNTIME: "pi",
    });
    expect(demoModelEnv({ ANTHROPIC_API_KEY: "a" }, false)).toMatchObject({
      PI_DEFAULT_PROVIDER: "anthropic",
    });
    expect(demoModelEnv({}, false)).toEqual({ AGENT_RUNTIME: "scripted" });
  });
});
