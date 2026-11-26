import { describe, expect, it } from "vitest";
import {
  hasMentionToken,
  inferHandoffTargetName,
  resolveGroupTargetBotIds,
} from "./group-mentions.js";

const members = [
  { id: "a", name: "BotA" },
  { id: "b", name: "BotB" },
  { id: "c", name: "Writer" },
];

describe("hasMentionToken", () => {
  it("requires a boundary after the complete member name", () => {
    expect(hasMentionToken("Ask @Ann to review", "Ann")).toBe(true);
    expect(hasMentionToken("Ask @Ann, then continue", "Ann")).toBe(true);
    expect(hasMentionToken("Ask @Anna to review", "Ann")).toBe(false);
    expect(hasMentionToken("name@Ann", "Ann")).toBe(false);
    expect(hasMentionToken("contact@everyone", "everyone")).toBe(false);
  });

  it("supports multi-word and Unicode member names", () => {
    expect(hasMentionToken("Ask @Research Writer and @Éditeur", "Research Writer")).toBe(true);
    expect(hasMentionToken("Ask @Research Writer and @Éditeur", "Éditeur")).toBe(true);
  });
});

describe("resolveGroupTargetBotIds", () => {
  it("returns mentioned bots from text", () => {
    expect(
      resolveGroupTargetBotIds({
        text: "@BotA gather sources. @BotB summarize.",
        members,
      }),
    ).toEqual(["a", "b"]);
  });

  it("returns all members for @everyone", () => {
    expect(
      resolveGroupTargetBotIds({
        text: "@everyone please review",
        members,
      }),
    ).toEqual(["a", "b", "c"]);
  });

  it("merges explicit mentions", () => {
    expect(
      resolveGroupTargetBotIds({
        text: "hello",
        members,
        explicitMentions: ["b"],
      }),
    ).toEqual(["b"]);
  });

  it("matches multi-word and Unicode names without prefix collisions", () => {
    const namedMembers = [
      { id: "research", name: "Research Writer" },
      { id: "edit", name: "Éditeur" },
      { id: "ann", name: "Ann" },
      { id: "anna", name: "Anna" },
    ];
    expect(
      resolveGroupTargetBotIds({
        text: "@Research Writer compare this with @Éditeur and @Anna.",
        members: namedMembers,
      }),
    ).toEqual(["research", "edit", "anna"]);
  });

  it("ignores explicit mentions for bots that are not group members", () => {
    expect(
      resolveGroupTargetBotIds({
        text: "hello",
        members,
        explicitMentions: ["b", "outsider"],
      }),
    ).toEqual(["b"]);
  });

  it("picks the first member when unmentioned", () => {
    expect(
      resolveGroupTargetBotIds({
        text: "hello team",
        members,
      }),
    ).toEqual(["a"]);
  });
});

describe("inferHandoffTargetName", () => {
  it("picks Writer when BotA is also mentioned", () => {
    expect(inferHandoffTargetName("@BotA hand this to Writer for the draft")).toBe("Writer");
  });
});

describe("longest member name wins", () => {
  const pair = [
    { id: "ada", name: "Ada" },
    { id: "ada-copy", name: "Ada copy" },
  ];
  it("does not wake the shorter member when the longer one is addressed", () => {
    expect(resolveGroupTargetBotIds({ text: "@Ada copy draft this", members: pair })).toEqual([
      "ada-copy",
    ]);
  });
  it("wakes both when both are mentioned separately", () => {
    expect(resolveGroupTargetBotIds({ text: "@Ada and @Ada copy", members: pair })).toEqual([
      "ada",
      "ada-copy",
    ]);
  });
});

describe("plain-word everyone", () => {
  const members = [
    { id: "a", name: "Chief" },
    { id: "b", name: "Legal" },
    { id: "c", name: "IR" },
  ];
  it("never broadcasts on the plain word", () => {
    expect(resolveGroupTargetBotIds({ text: "status from everyone please", members })).toEqual([
      "a",
    ]);
    expect(
      resolveGroupTargetBotIds({ text: "@Legal do not send this to everybody", members }),
    ).toEqual(["b"]);
    expect(resolveGroupTargetBotIds({ text: "mail contact@everyone.test", members })).toEqual([
      "a",
    ]);
  });
  it("lets explicit chips win over @everyone text", () => {
    expect(
      resolveGroupTargetBotIds({ text: "@everyone hi", members, explicitMentions: ["b"] }),
    ).toEqual(["b"]);
  });
});
