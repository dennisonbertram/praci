import { describe, expect, it } from "vitest";
import { runTool, toolSourceHash } from "./tool-runner.js";

const sum = `function run(input) { return { total: input.items.reduce((a, b) => a + b, 0) }; }`;

describe("runTool", () => {
  it("runs run(input) and returns the JSON result", async () => {
    expect(await runTool(sum, { items: [1, 2, 3] })).toEqual({ result: { total: 6 } });
  });

  it("interrupts an infinite loop at the deadline", async () => {
    const started = Date.now();
    const out = await runTool("function run() { while (true) {} }", {});
    expect(out).toHaveProperty("error");
    expect(Date.now() - started).toBeLessThan(4000);
  });

  it("fails cleanly on a memory bomb", async () => {
    const out = await runTool("function run() { var s = 'x'; while (true) { s = s + s; } }", {});
    expect(out).toHaveProperty("error");
    const arrays = await runTool("function run() { var a = []; while (true) a.push([a]); }", {});
    expect(arrays).toHaveProperty("error");
  });

  it("fails cleanly on runaway recursion", async () => {
    const out = await runTool("function run() { return (function f() { return f(); })(); }", {});
    expect(out).toHaveProperty("error");
  });

  it("exposes no host objects", async () => {
    const out = await runTool(
      `function run() { return [typeof require, typeof process, typeof fetch, typeof setTimeout,
        typeof setInterval, typeof module, typeof Buffer, typeof console, typeof XMLHttpRequest]; }`,
      {},
    );
    expect(out).toEqual({ result: Array(9).fill("undefined") });
  });

  it("cannot import", async () => {
    expect(await runTool(`import fs from "fs"; function run() {}`, {})).toHaveProperty("error");
    expect(await runTool(`function run() { return import("fs"); }`, {})).toHaveProperty("error");
  });

  it("caps the output", async () => {
    const out = await runTool(`function run() { return "x".repeat(300000); }`, {});
    expect(out).toEqual({ error: "The result is too large." });
  });

  it("returns a thrown error's message without a stack", async () => {
    const out = await runTool(`function run() { throw new Error("bad input"); }`, {});
    expect(out).toEqual({ error: "bad input" });
  });

  it("rejects results that are not JSON", async () => {
    for (const body of ["return undefined;", "return () => 1;", "return Promise.resolve(1);"]) {
      expect(await runTool(`function run() { ${body} }`, {})).toHaveProperty("error");
    }
    expect(await runTool("var x = 1;", {})).toEqual({
      error: "The tool must define function run(input).",
    });
  });

  it("keeps a polluted input inside the VM", async () => {
    const input = JSON.parse(
      '{"__proto__":{"polluted":true},"constructor":{"prototype":{"p2":1}}}',
    );
    const out = await runTool(
      `function run(i) { Object.prototype.hacked = 1; return { seen: ({}).hacked }; }`,
      input,
    );
    expect(out).toEqual({ result: { seen: 1 } });
    expect(({} as Record<string, unknown>).hacked).toBeUndefined();
    expect(({} as Record<string, unknown>).polluted).toBeUndefined();
  });

  it("gives each call a fresh VM and does not mutate the caller's input", async () => {
    const input = { items: [1] };
    await runTool(`var leak = 1; function run(i) { i.items.push(2); return leak; }`, input);
    expect(input.items).toEqual([1]);
    expect(await runTool(`function run() { return typeof leak; }`, {})).toEqual({
      result: "undefined",
    });
  });

  it("hashes the source", () => {
    expect(toolSourceHash("a")).toMatch(/^[0-9a-f]{64}$/);
    expect(toolSourceHash("a")).not.toBe(toolSourceHash("b"));
  });
});
