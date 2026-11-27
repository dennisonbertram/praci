import { expect, it } from "vitest";
import type { ComposeRestore } from "../ComposeEmail";
import { forgetClosed, recallClosed, rememberClosed } from "./draft-memory";

const composer = { clientId: "c1" } as ComposeRestore;

it("hands back the last closed reply of the same message under Reply and Reply all", () => {
  rememberClosed({ kind: "reply", messageId: "m1" }, composer);
  expect(recallClosed({ kind: "replyAll", messageId: "m1" })).toBe(composer);
  expect(recallClosed({ kind: "replyAll", messageId: "m1" }, "space-b")).toBe(composer);
  expect(recallClosed({ kind: "forward", messageId: "m1" })).toBeUndefined();
  expect(recallClosed({ kind: "reply", messageId: "m2" })).toBeUndefined();
  expect(recallClosed({ kind: "reply", messageId: "m1" })).toBe(composer);
  forgetClosed({ kind: "replyAll", messageId: "m1" });
  expect(recallClosed({ kind: "reply", messageId: "m1" })).toBeUndefined();
});

it("forgets on discard and scopes a new message to its Space", () => {
  rememberClosed({ kind: "forward", messageId: "m1" }, composer);
  forgetClosed({ kind: "forward", messageId: "m1" });
  expect(recallClosed({ kind: "forward", messageId: "m1" })).toBeUndefined();
  rememberClosed({ kind: "new" }, { ...composer, spaceId: "space-a", deliveryStatus: "uncertain" });
  expect(recallClosed({ kind: "new" }, "space-a")).toBeDefined();
  expect(recallClosed({ kind: "new" }, "space-b")).toBeUndefined();
  forgetClosed({ kind: "new" }, "space-a");
  expect(recallClosed({ kind: "new" }, "space-a")).toBeUndefined();
  rememberClosed({ kind: "new" }, { ...composer, spaceId: "space-a" });
  expect(recallClosed({ kind: "new" }, "space-a")).toBeUndefined();
});
