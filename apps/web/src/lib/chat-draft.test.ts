// @vitest-environment jsdom
import { afterEach, expect, it } from "vitest";
import { readChatDraft, writeChatDraft } from "./chat-draft";

afterEach(() => sessionStorage.clear());

it("keeps one draft per chat and forgets it once cleared", () => {
  writeChatDraft("bot:chief", "Board meeting agenda");
  writeChatDraft("bot:carta", "Who are our investors?");
  expect(readChatDraft("bot:chief")).toBe("Board meeting agenda");
  writeChatDraft("bot:chief", "");
  expect(readChatDraft("bot:chief")).toBe("");
  expect(readChatDraft("bot:carta")).toBe("Who are our investors?");
  expect(readChatDraft(undefined)).toBe("");
});
