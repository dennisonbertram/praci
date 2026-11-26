import { describe, expect, it } from "vitest";
import { replyToAnnounce } from "./reply-announcement";

type Message = { id: string; role: string };

describe("replyToAnnounce", () => {
  it("never returns history present at the first load", () => {
    const history: Message[] = [{ id: "history", role: "assistant" }];
    expect(replyToAnnounce(history, new Set(history.map(({ id }) => id)))).toBeNull();
  });

  it("never returns progress messages", () => {
    expect(replyToAnnounce([{ id: "progress:run-1", role: "assistant" }], new Set())).toBeNull();
  });

  it("never returns the same id twice", () => {
    const message: Message = { id: "reply-1", role: "assistant" };
    expect(replyToAnnounce([message], new Set([message.id]))).toBeNull();
  });

  it("never returns a user message", () => {
    expect(replyToAnnounce([{ id: "user-1", role: "user" }], new Set())).toBeNull();
  });

  it("returns a new finished assistant message once", () => {
    const message: Message = { id: "reply-1", role: "assistant" };
    const announced = new Set<string>();
    expect(replyToAnnounce([message], announced)).toBe(message);
    announced.add(message.id);
    expect(replyToAnnounce([message], announced)).toBeNull();
  });
});
