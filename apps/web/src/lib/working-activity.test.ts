import type { ThreadMessage } from "@rakazo/contracts";
import { reduceLiveMessageBlocks } from "@rakazo/core";
import { describe, expect, it, vi } from "vitest";
import { workingActivity } from "./working-activity";

vi.mock("@lingui/core/macro", () => ({
  t: (strings: TemplateStringsArray, ...values: unknown[]) => String.raw(strings, ...values),
}));

const run = { id: "run-1", botId: "bot-1", status: "running" as const };
const botMessage = (blocks: ThreadMessage["blocks"]): ThreadMessage => ({
  id: "m-1",
  threadId: "t-1",
  seq: 1,
  role: "bot",
  botId: "bot-1",
  runId: "run-1",
  blocks,
  createdAt: "2026-10-11T00:00:00.000Z",
});

describe("workingActivity", () => {
  it("names the tool the run is using", () => {
    expect(
      workingActivity(run, [
        botMessage([{ kind: "steps", steps: [{ label: "List transactions", count: 1 }] }]),
      ]),
    ).toEqual({ kind: "tool", label: "List transactions" });
    expect(
      workingActivity(run, [
        botMessage([{ kind: "progress", text: "Checking", pendingToolNames: ["get_balance"] }]),
      ]),
    ).toEqual({ kind: "tool", label: "Get balance" });
  });

  it("names common tools by what they do, whether MCP or built in", () => {
    expect(
      workingActivity(run, [
        botMessage([
          { kind: "progress", text: "", pendingToolNames: ["mcp__integration-1__fetch"] },
        ]),
      ]),
    ).toEqual({ kind: "tool", label: "Fetch", action: "connected-app" });
    expect(
      workingActivity(run, [
        botMessage([
          { kind: "progress", text: "", pendingToolNames: ["mcp__carta__cap_table_chart"] },
        ]),
      ]),
    ).toEqual({ kind: "tool", label: "Carta cap table", action: "carta-cap-table" });
    expect(
      workingActivity(run, [
        botMessage([{ kind: "steps", steps: [{ label: "Contacts add", count: 1 }] }]),
      ]),
    ).toEqual({ kind: "tool", label: "Contacts add", action: "contact-add" });
    expect(
      workingActivity(run, [
        botMessage([{ kind: "progress", text: "", pendingToolNames: ["show_emails"] }]),
      ]),
    ).toEqual({ kind: "tool", label: "Show emails", action: "mail-show" });
  });

  it("reports status before any output, and writing once text streams", () => {
    expect(workingActivity({ ...run, status: "queued" }, [])).toEqual({ kind: "starting" });
    expect(workingActivity(run, [])).toEqual({ kind: "thinking" });
    expect(workingActivity(run, [botMessage([{ kind: "text", text: "Here" }])])).toEqual({
      kind: "writing",
    });
  });

  it("treats provider status chatter as thinking, not writing", () => {
    expect(
      workingActivity(run, [
        botMessage([{ kind: "progress", text: "still working…", activity: true }]),
      ]),
    ).toEqual({ kind: "thinking" });
    expect(
      workingActivity(run, [botMessage([{ kind: "progress", text: "Drafting reply" }])]),
    ).toEqual({ kind: "writing" });
    expect(
      workingActivity(run, [
        botMessage([
          { kind: "progress", text: "x", activity: true, pendingToolNames: ["get_balance"] },
        ]),
      ]),
    ).toEqual({ kind: "tool", label: "Get balance" });
  });

  it("carries the latest step a Gmail tool reported, and the service it waits on", () => {
    expect(
      workingActivity(run, [
        botMessage([
          {
            kind: "progress",
            text: 'Searching mail: from Kevin · "pick a time"',
            activity: true,
            pendingToolNames: ["mail_search"],
          },
        ]),
      ]),
    ).toEqual({
      kind: "tool",
      label: "Mail search",
      action: "mail-search",
      detail: 'Searching mail: from Kevin · "pick a time"',
      service: "Gmail",
    });
  });

  it("ends the step line with an exclamation mark without losing it", () => {
    const blocks = reduceLiveMessageBlocks(
      [{ kind: "progress", text: "", activity: true, pendingToolNames: ["mail_get"] }],
      {
        type: "progress",
        payload: { text: 'Reading "Welcome!" from hi@example.test', activity: true },
      },
    );
    expect(workingActivity(run, [botMessage(blocks)])).toMatchObject({
      detail: 'Reading "Welcome!" from hi@example.test',
    });
  });

  it("shows no step line for a tool that does not report", () => {
    expect(
      workingActivity(run, [
        botMessage([
          {
            kind: "progress",
            text: "Searching the web: x",
            activity: true,
            pendingToolNames: ["web_search"],
          },
        ]),
      ]),
    ).not.toHaveProperty("detail");
  });

  describe("run phase", () => {
    const at = "2026-10-11T00:00:00.000Z";
    const queued = { ...run, status: "queued" as const };

    it("shows what a queued run waits on instead of Starting", () => {
      const phase = { kind: "computer_wait" as const, at };
      expect(workingActivity({ ...queued, phase }, [])).toEqual({ kind: "phase", phase });
      expect(workingActivity(queued, [])).toEqual({ kind: "starting" });
    });

    it("shows the phase until the run has a live message", () => {
      const phase = { kind: "model_wait" as const, name: "GPT-6 Luna", at };
      expect(workingActivity({ ...run, phase }, [])).toEqual({ kind: "phase", phase });
    });

    it("lets live tool activity win over the phase", () => {
      const phase = { kind: "connecting" as const, name: "Devin", at };
      const messages = [
        botMessage([{ kind: "progress", text: "", pendingToolNames: ["get_balance"] }]),
      ];
      expect(workingActivity({ ...run, phase }, messages)).toEqual({
        kind: "tool",
        label: "Get balance",
      });
    });

    it("keeps Thinking for a thinking phase", () => {
      const phase = { kind: "thinking" as const, at };
      expect(workingActivity({ ...run, phase }, [])).toEqual({ kind: "thinking" });
      expect(workingActivity({ ...queued, phase }, [])).toEqual({ kind: "starting" });
    });
  });
});
