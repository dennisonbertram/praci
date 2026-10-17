import { expect, it } from "vitest";
import type { ComposeRestore } from "../ComposeEmail";
import { forgetClosed, recallClosed, rememberClosed } from "./draft-memory";

const composer = { clientId: "c1" } as ComposeRestore;

it("hands back the last closed reply of the same message under Reply and Reply all", () => {
  rememberClosed({ kind: "reply", messageId: "m1" }, composer);
  expect(recallClosed({ kind: "replyAll", messageId: "m1" })).toBe(composer);
  expect(recallClosed({ kind: "forward", messageId: "m1" })).toBeUndefined();
  expect(recallClosed({ kind: "reply", messageId: "m2" })).toBeUndefined();
  expect(recallClosed({ kind: "reply", messageId: "m1" })).toBe(composer);
  forgetClosed({ kind: "replyAll", messageId: "m1" });
  expect(recallClosed({ kind: "reply", messageId: "m1" })).toBeUndefined();
});

it("forgets on discard and never keeps a new message", () => {
  rememberClosed({ kind: "forward", messageId: "m1" }, composer);
  forgetClosed({ kind: "forward", messageId: "m1" });
  expect(recallClosed({ kind: "forward", messageId: "m1" })).toBeUndefined();
  rememberClosed({ kind: "new" }, composer);
  expect(recallClosed({ kind: "new" })).toBeUndefined();
});
