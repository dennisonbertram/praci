import { describe, expect, it } from "vitest";
import {
  latestAnswerableAskMessageId,
  ownerOnlyCredentialAskMessageIds,
  resolveAskChoice,
  selectedAskActionLabel,
} from "./answerable-ask.js";

describe("latestAnswerableAskMessageId", () => {
  it("finds a waiting prompt even when a newer group run is active", () => {
    expect(
      latestAnswerableAskMessageId({
        run: { id: "run-newer", status: "running" },
        activeRuns: [
          { id: "run-newer", status: "running" },
          { id: "run-waiting", status: "waiting_input" },
        ],
        messages: [
          {
            id: "ask-1",
            runId: "run-waiting",
            blocks: [{ kind: "ask", status: "pending" }],
          },
        ],
      }),
    ).toBe("ask-1");
  });

  it("ignores answered prompts and prompts from non-waiting runs", () => {
    expect(
      latestAnswerableAskMessageId({
        run: { id: "run-1", status: "running" },
        messages: [{ id: "ask-1", runId: "run-1", blocks: [{ kind: "ask", status: "pending" }] }],
      }),
    ).toBeNull();
    expect(
      latestAnswerableAskMessageId({
        run: { id: "run-1", status: "waiting_input" },
        messages: [{ id: "ask-1", runId: "run-1", blocks: [{ kind: "ask", status: "answered" }] }],
      }),
    ).toBeNull();
  });
});

describe("selectedAskActionLabel", () => {
  it("maps a choice answer id to its user-facing label", () => {
    expect(
      selectedAskActionLabel("choice-2", [
        { id: "choice-1", label: "Berlin" },
        { id: "choice-2", label: "Seoul" },
      ]),
    ).toBe("Seoul");
  });

  it("falls back to the answer when an action is unavailable", () => {
    expect(selectedAskActionLabel("custom", undefined)).toBe("custom");
  });
});

describe("resolveAskChoice", () => {
  const actions = [
    { id: "choice-1", label: "Berlin" },
    { id: "choice-2", label: "Seoul" },
  ];

  it("matches an offered choice by id or label", () => {
    expect(resolveAskChoice("choice-2", actions)).toEqual({ id: "choice-2", label: "Seoul" });
    expect(resolveAskChoice(" seoul ", actions)).toEqual({ id: "choice-2", label: "Seoul" });
  });

  it("leaves unmatched free-text as a custom answer", () => {
    expect(resolveAskChoice("Toronto", actions)).toBeUndefined();
  });
});

describe("ownerOnlyCredentialAskMessageIds", () => {
  const snapshot = {
    activeRuns: [
      { id: "run-mine", status: "waiting_input", userId: "user-1" },
      { id: "run-theirs", status: "waiting_input", userId: "user-2" },
      { id: "run-unknown", status: "waiting_input" },
    ],
    messages: ["run-mine", "run-theirs", "run-unknown"].map((runId) => ({
      id: `ask-${runId}`,
      runId,
      blocks: [{ kind: "ask", input: "secret", credential: {}, status: "pending" }],
    })),
  };

  it("hides another user's, or an unknown user's, credential request from the viewer", () => {
    expect([...ownerOnlyCredentialAskMessageIds(snapshot, "user-1")].sort()).toEqual([
      "ask-run-theirs",
      "ask-run-unknown",
    ]);
    expect(ownerOnlyCredentialAskMessageIds(snapshot, undefined).size).toBe(3);
  });

  it("leaves connector codes, questions and answered requests alone", () => {
    const others = {
      activeRuns: [{ id: "run-theirs", status: "waiting_input", userId: "user-2" }],
      messages: [
        { id: "code", runId: "run-theirs", blocks: [{ kind: "ask", input: "secret" }] },
        { id: "question", runId: "run-theirs", blocks: [{ kind: "ask", input: "text" }] },
        {
          id: "done",
          runId: "run-theirs",
          blocks: [{ kind: "ask", input: "secret", credential: {}, status: "answered" }],
        },
      ],
    };
    expect(ownerOnlyCredentialAskMessageIds(others, "user-1").size).toBe(0);
  });
});
