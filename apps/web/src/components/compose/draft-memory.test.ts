import { expect, it } from "vitest";
import type { ComposeRestore } from "../ComposeEmail";
import { forgetClosed, recallClosed, rememberClosed } from "./draft-memory";

const composer = { clientId: "c1" } as ComposeRestore;

it("hands back the last closed composer of the same mode and message", () => {
  rememberClosed({ kind: "reply", messageId: "m1" }, composer);
  expect(recallClosed({ kind: "replyAll", messageId: "m1" })).toBeUndefined();
  expect(recallClosed({ kind: "reply", messageId: "m2" })).toBeUndefined();
  expect(recallClosed({ kind: "reply", messageId: "m1" })).toBe(composer);
});

it("forgets on discard and never keeps a new message", () => {
  rememberClosed({ kind: "forward", messageId: "m1" }, composer);
  forgetClosed({ kind: "forward", messageId: "m1" });
  expect(recallClosed({ kind: "forward", messageId: "m1" })).toBeUndefined();
  rememberClosed({ kind: "new" }, composer);
  expect(recallClosed({ kind: "new" })).toBeUndefined();
});
