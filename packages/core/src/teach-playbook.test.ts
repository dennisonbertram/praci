import { describe, expect, it } from "vitest";
import {
  ASK_SIGN_IN_STEP,
  applyPlainSteps,
  buildPlaybookFromRecording,
  buildPlaybookWithProtected,
  fillLoginStep,
  formatSkillRunPrompt,
  PROTECTED_STEP,
  parseSkillResult,
  promptInvokesSkill,
  redactSecretText,
  sanitizeTeachRecordingEvent,
  scrubValues,
  splitWindowTitle,
} from "./teach-playbook.js";

describe("promptInvokesSkill", () => {
  it("matches an explicit request to run the skill", () => {
    expect(promptInvokesSkill("run Export weekly CRM list", "Export weekly CRM list")).toBe(true);
    expect(promptInvokesSkill("Please use the Export CRM skill now", "Export CRM")).toBe(true);
  });

  it("ignores prompts that only mention the name in passing", () => {
    expect(promptInvokesSkill("export the notes to markdown", "Export")).toBe(false);
    expect(promptInvokesSkill("run the exporter script", "Export")).toBe(false);
    expect(promptInvokesSkill("run a report", "Export weekly CRM list")).toBe(false);
  });

  it("skips prompts that already carry the playbook and very short names", () => {
    expect(promptInvokesSkill("Run taught skill: Export\nSteps:", "Export")).toBe(false);
    expect(promptInvokesSkill("run cs now", "cs")).toBe(false);
  });
});

describe("buildPlaybookFromRecording", () => {
  it("turns pointer and typing events into steps", () => {
    const playbook = buildPlaybookFromRecording(
      "Export weekly CRM list",
      [
        { at: "2026-01-01T00:00:00.000Z", kind: "pointer", x: 120, y: 40, type: "click" },
        { at: "2026-01-01T00:00:01.000Z", kind: "clipboard", text: "weekly-export.csv" },
      ],
      [{ at: "2026-01-01T00:00:02.000Z", summary: "Export dialog open" }],
    );

    expect(playbook.steps.some((step) => step.includes("Click"))).toBe(true);
    expect(playbook.steps.some((step) => step.includes("weekly-export.csv"))).toBe(true);
    expect(playbook.steps.some((step) => step.includes("Export dialog open"))).toBe(false);
    expect(playbook.howToCheck).toContain("Export dialog open");
    expect(playbook.whenToUse).toContain("Export weekly CRM list");
    expect(playbook.approvalBoundaries.length).toBeGreaterThan(0);
    expect(playbook.failureHandling.length).toBeGreaterThan(0);
  });

  it("does not echo a protected typed value through the final snapshot summary", () => {
    const playbook = buildPlaybookFromRecording(
      "Sign in",
      [
        { at: "2026-01-01T00:00:00.000Z", kind: "clipboard", text: "fakepass123", sensitive: true },
        { at: "2026-01-01T00:00:01.000Z", kind: "key", key: "f", sensitive: true },
      ].map((event) => sanitizeTeachRecordingEvent(event as never)),
      [{ at: "2026-01-01T00:00:02.000Z", summary: "Login - fakepass123" }],
    );
    expect(JSON.stringify(playbook)).not.toContain("fakepass123");
    expect(formatSkillRunPrompt("Sign in", playbook)).not.toContain("fakepass123");
  });

  it("fills approval and failure fields when the demo lacked them", () => {
    const playbook = buildPlaybookFromRecording("Save a note", []);
    expect(playbook.approvalBoundaries).toContain("approval");
    expect(playbook.failureHandling).toContain("stop");
    expect(playbook.steps.length).toBeGreaterThan(0);
  });

  it("redacts obvious password-like input", () => {
    const playbook = buildPlaybookFromRecording("Sign in", [
      { at: "2026-01-01T00:00:00.000Z", kind: "clipboard", text: "my-password" },
    ]);
    expect(playbook.steps.join(" ")).toContain("[redacted input]");
  });

  it("coalesces consecutive typed characters and keeps repeated keys", () => {
    const playbook = buildPlaybookFromRecording("Search", [
      { at: "2026-01-01T00:00:00.000Z", kind: "key", key: "b" },
      { at: "2026-01-01T00:00:00.100Z", kind: "key", key: "o" },
      { at: "2026-01-01T00:00:00.200Z", kind: "key", key: "o" },
      { at: "2026-01-01T00:00:00.300Z", kind: "key", key: "k" },
      { at: "2026-01-01T00:00:00.400Z", kind: "key", key: "Enter" },
    ]);
    expect(playbook.steps).toEqual(['Type "book".', "Press key: Enter."]);
  });

  it("keeps spaces typed during a demo", () => {
    const playbook = buildPlaybookFromRecording("Search", [
      { at: "2026-01-01T00:00:00.000Z", kind: "key", key: "h" },
      { at: "2026-01-01T00:00:00.100Z", kind: "key", key: "i" },
      { at: "2026-01-01T00:00:00.200Z", kind: "key", key: " " },
      { at: "2026-01-01T00:00:00.300Z", kind: "key", key: "t" },
      { at: "2026-01-01T00:00:00.400Z", kind: "key", key: "h" },
      { at: "2026-01-01T00:00:00.500Z", kind: "key", key: "e" },
      { at: "2026-01-01T00:00:00.600Z", kind: "key", key: "r" },
      { at: "2026-01-01T00:00:00.700Z", kind: "key", key: "e" },
    ]);
    expect(playbook.steps).toEqual(['Type "hi there".']);
  });

  it("collapses a run of protected keystrokes into one redacted step", () => {
    const playbook = buildPlaybookFromRecording("Sign in", [
      { at: "2026-01-01T00:00:00.000Z", kind: "key", key: "u" },
      { at: "2026-01-01T00:00:00.100Z", kind: "key", key: "s" },
      { at: "2026-01-01T00:00:00.200Z", kind: "key", key: "e" },
      { at: "2026-01-01T00:00:00.300Z", kind: "key", key: "r" },
      { at: "2026-01-01T00:00:00.400Z", kind: "key", sensitive: true },
      { at: "2026-01-01T00:00:00.500Z", kind: "key", sensitive: true },
      { at: "2026-01-01T00:00:00.600Z", kind: "key", sensitive: true },
      { at: "2026-01-01T00:00:00.700Z", kind: "key", sensitive: true },
      { at: "2026-01-01T00:00:00.800Z", kind: "key", key: "Enter" },
    ]);
    expect(playbook.steps).toEqual([
      'Type "user".',
      'Type "[redacted input]".',
      "Press key: Enter.",
    ]);
  });

  it("never renders the payload of a protected event", () => {
    const playbook = buildPlaybookFromRecording("Sign in", [
      { at: "2026-01-01T00:00:00.000Z", kind: "key", key: "x", sensitive: true },
      { at: "2026-01-01T00:00:00.100Z", kind: "clipboard", text: "hunter2", sensitive: true },
    ]);
    expect(playbook.steps.join(" ")).toContain("[redacted input]");
    expect(playbook.steps.join(" ")).not.toContain("hunter2");
    expect(playbook.steps.join(" ")).not.toContain('"x"');
  });

  it("resumes ordinary typing after a protected run", () => {
    const playbook = buildPlaybookFromRecording("Sign in", [
      { at: "2026-01-01T00:00:00.000Z", kind: "key", sensitive: true },
      { at: "2026-01-01T00:00:00.100Z", kind: "key", sensitive: true },
      { at: "2026-01-01T00:00:00.200Z", kind: "key", key: "o" },
      { at: "2026-01-01T00:00:00.300Z", kind: "key", key: "k" },
    ]);
    expect(playbook.steps).toEqual(['Type "[redacted input]".', 'Type "ok".']);
  });

  it("redacts typed credentials the same way as clipboard input", () => {
    const playbook = buildPlaybookFromRecording("Sign in", [
      { at: "2026-01-01T00:00:00.000Z", kind: "key", key: "p" },
      { at: "2026-01-01T00:00:00.100Z", kind: "key", key: "a" },
      { at: "2026-01-01T00:00:00.200Z", kind: "key", key: "s" },
      { at: "2026-01-01T00:00:00.300Z", kind: "key", key: "s" },
      { at: "2026-01-01T00:00:00.400Z", kind: "key", key: "w" },
      { at: "2026-01-01T00:00:00.500Z", kind: "key", key: "o" },
      { at: "2026-01-01T00:00:00.600Z", kind: "key", key: "r" },
      { at: "2026-01-01T00:00:00.700Z", kind: "key", key: "d" },
    ]);
    expect(playbook.steps.join(" ")).toContain("[redacted input]");
    expect(playbook.steps.join(" ")).not.toContain("password");
  });

  it("coalesces a press-and-release into a click and keeps a drag", () => {
    const click = buildPlaybookFromRecording("Open", [
      { at: "2026-01-01T00:00:00.000Z", kind: "pointer", x: 10, y: 20, type: "down" },
      { at: "2026-01-01T00:00:00.050Z", kind: "pointer", x: 10, y: 20, type: "up" },
    ]);
    expect(click.steps).toEqual(["Click left button at (10, 20)."]);

    const drag = buildPlaybookFromRecording("Move", [
      { at: "2026-01-01T00:00:00.000Z", kind: "pointer", x: 10, y: 20, type: "down" },
      { at: "2026-01-01T00:00:00.050Z", kind: "pointer", x: 80, y: 90, type: "move" },
      { at: "2026-01-01T00:00:00.080Z", kind: "pointer", x: 80, y: 90, type: "up" },
    ]);
    expect(drag.steps).toEqual(["Drag left button from (10, 20) to (80, 90)."]);
  });

  it("records scroll steps from a demo", () => {
    const playbook = buildPlaybookFromRecording("Scroll the list", [
      { at: "2026-01-01T00:00:00.000Z", kind: "scroll", type: "down", text: "3" },
    ]);
    expect(playbook.steps).toEqual(["Scroll down 3 times."]);
  });
});

describe("sanitizeTeachRecordingEvent", () => {
  it("strips the captured value from a protected event", () => {
    expect(
      sanitizeTeachRecordingEvent({
        at: "2026-01-01T00:00:00.000Z",
        kind: "clipboard",
        text: "hunter2",
        sensitive: true,
      }),
    ).toEqual({ at: "2026-01-01T00:00:00.000Z", kind: "clipboard", sensitive: true });
    expect(
      sanitizeTeachRecordingEvent({
        at: "2026-01-01T00:00:00.000Z",
        kind: "key",
        key: "x",
        sensitive: true,
      }),
    ).toEqual({ at: "2026-01-01T00:00:00.000Z", kind: "key", sensitive: true });
  });

  it("leaves ordinary events untouched", () => {
    const event = {
      at: "2026-01-01T00:00:00.000Z",
      kind: "clipboard" as const,
      text: "weekly-export.csv",
    };
    expect(sanitizeTeachRecordingEvent(event)).toEqual(event);
  });
});

describe("password fields without Protected input", () => {
  it("treats a key typed into a field labelled Password as protected", () => {
    const stored = ["h", "u", "n", "t", "e", "r", "2"].map((key, index) =>
      sanitizeTeachRecordingEvent({
        at: `2026-01-01T00:00:0${index}.000Z`,
        kind: "key",
        key,
        field: "Password",
      }),
    );
    expect(JSON.stringify(stored)).not.toContain("hunter2");
    expect(stored.every((event) => event.sensitive && event.key === undefined)).toBe(true);
    const { playbook, protectedSteps } = buildPlaybookWithProtected("Sign in", stored);
    expect(playbook.steps).toEqual([PROTECTED_STEP]);
    expect(protectedSteps).toEqual([{ stepIndex: 0, segment: 0, field: "Password" }]);
  });

  it("keeps an ordinary field typed as before", () => {
    const stored = sanitizeTeachRecordingEvent({
      at: "2026-01-01T00:00:00.000Z",
      kind: "key",
      key: "a",
      field: "Username",
    });
    expect(stored.key).toBe("a");
    expect(stored.sensitive).toBeUndefined();
  });

  it("drops a clipboard value sent to a PIN field and numbers separate values apart", () => {
    const { playbook, protectedSteps } = buildPlaybookWithProtected("x", [
      sanitizeTeachRecordingEvent({
        at: "t1",
        kind: "clipboard",
        text: "123456",
        field: "Security code",
        segment: 0,
      }),
      { at: "t2", kind: "pointer", x: 1, y: 2, type: "click" },
      { at: "t3", kind: "key", sensitive: true, segment: 1 },
    ]);
    expect(playbook.steps.join(" ")).not.toContain("123456");
    expect(protectedSteps.map((step) => [step.stepIndex, step.segment])).toEqual([
      [0, 0],
      [2, 1],
    ]);
  });

  it("scrubs a held value from text that echoes it", () => {
    expect(scrubValues("Sign in - hunter2 - Chrome", ["hunter2"])).toBe(
      "Sign in - [redacted] - Chrome",
    );
  });

  it("redacts the whole text when a one or two character value appears in it", () => {
    expect(scrubValues("Report 7 - Calc", ["7"])).toBe("[redacted]");
    expect(scrubValues("Inbox ab", ["ab"])).toBe("[redacted]");
    expect(scrubValues("Inbox", ["ab", ""])).toBe("Inbox");
  });
});

describe("whole desktop events", () => {
  it("records window switches, written file paths and commands as steps", () => {
    const events = [
      { at: "1", kind: "window" as const, app: "LibreOffice Calc", title: "Pipeline.xlsx" },
      { at: "2", kind: "file" as const, path: "shared/pipeline.csv", text: "secret,row" },
      { at: "3", kind: "command" as const, command: "node export.js" },
    ].map(sanitizeTeachRecordingEvent);
    expect(events[1]?.text).toBeUndefined();
    expect(buildPlaybookFromRecording("Export", events).steps).toEqual([
      "Switch to LibreOffice Calc: Pipeline.xlsx.",
      "Save the file shared/pipeline.csv.",
      "Run the command: node export.js",
    ]);
  });

  it("removes secrets and tokens from commands, titles and paths", () => {
    const command = sanitizeTeachRecordingEvent({
      at: "1",
      kind: "command",
      command:
        "curl -H 'Authorization: Bearer abcDEF123456' https://user:pw123@host.test --password=hunter2 API_TOKEN=zzz ghp_abcdefghijklmnopqrstuvwxyz0123", // gitleaks:allow -- synthetic credential-shaped redaction fixture
    }).command;
    expect(command).not.toMatch(/abcDEF123456|pw123|hunter2|zzz|ghp_abc/);
    expect(redactSecretText("git status")).toBe("git status");
    expect(
      sanitizeTeachRecordingEvent({
        at: "1",
        kind: "window",
        title: "Key sk-live0123456789abcdefXYZ",
      }).title,
    ).not.toContain("sk-live");
  });
});

describe("login steps in a run prompt", () => {
  it("tells the bot how to run and recover a login step", () => {
    const playbook = {
      ...buildPlaybookFromRecording("Sign in", []),
      steps: [fillLoginStep("crm", "Password"), ASK_SIGN_IN_STEP],
    };
    const prompt = formatSkillRunPrompt("Sign in", playbook);
    expect(prompt).toContain("1. Fill saved login crm into Password.");
    expect(prompt).toContain("fill_secret");
    expect(prompt).toContain("request_secret");
    expect(formatSkillRunPrompt("x", buildPlaybookFromRecording("x", []))).not.toContain(
      "fill_secret",
    );
  });
});

describe("applyPlainSteps", () => {
  const held = [{ stepIndex: 2, segment: 4, field: "Password" }];

  it("maps each protected step to its new position", () => {
    expect(
      applyPlainSteps(held, ["Open the CRM sign-in page.", PROTECTED_STEP, "Click Sign in."]),
    ).toEqual({
      steps: ["Open the CRM sign-in page.", PROTECTED_STEP, "Click Sign in."],
      protectedSteps: [{ stepIndex: 1, segment: 4, field: "Password" }],
    });
  });

  it("refuses an answer that dropped or invented a protected step", () => {
    expect(applyPlainSteps(held, ["Click Sign in."])).toBeNull();
    expect(applyPlainSteps([], [PROTECTED_STEP])).toBeNull();
    expect(applyPlainSteps([], [])).toBeNull();
  });
});

describe("splitWindowTitle", () => {
  it("names the app after the last separator", () => {
    expect(splitWindowTitle("Pipeline.xlsx - LibreOffice Calc")).toEqual({
      app: "LibreOffice Calc",
      title: "Pipeline.xlsx - LibreOffice Calc",
    });
    expect(splitWindowTitle("Terminal")).toEqual({ title: "Terminal" });
  });
});

describe("parseSkillResult", () => {
  it("is worked only on an explicit Result: worked line", () => {
    expect(parseSkillResult("Done.\nResult: worked")).toEqual({ outcome: "worked", note: null });
    expect(parseSkillResult("Done.").outcome).toBe("stopped");
    expect(parseSkillResult(null).outcome).toBe("stopped");
  });

  it("names the step and reason when the bot stopped", () => {
    expect(
      parseSkillResult("Could not log in.\nResult: stopped at step 4: no Login button"),
    ).toEqual({ outcome: "stopped", note: "Stopped at step 4: no Login button" });
    expect(parseSkillResult("Result: stopped: blocked").note).toBe("Stopped: blocked");
  });

  it("asks for the result line in every run prompt", () => {
    expect(
      formatSkillRunPrompt(
        "X",
        {
          whenToUse: "x",
          inputs: [],
          steps: ["Click Export."],
          howToCheck: "x",
          whatToReturn: "x",
          approvalBoundaries: "x",
          failureHandling: "x",
        },
        true,
      ),
    ).toContain("Result: worked");
  });
});
