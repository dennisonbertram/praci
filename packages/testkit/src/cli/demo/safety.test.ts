import { describe, expect, it } from "vitest";
import { assertDemoContainer, childEnv } from "./safety.js";

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
});
