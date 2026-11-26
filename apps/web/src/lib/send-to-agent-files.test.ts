import { ATTACHMENT_MAX_COUNT } from "@rakazo/contracts";
import { beforeEach, expect, it, vi } from "vitest";

const get = vi.fn();
vi.mock("./rpc", () => ({ rpc: { artifacts: { get: (...a: unknown[]) => get(...a) } } }));

import { acceptAttachments, fetchMessageFiles } from "./send-to-agent";

const b64 = (text: string) => ({ contentBase64: btoa(text) });
const blocks = [
  { kind: "text" },
  { kind: "file", artifactId: "a1", name: "one.md", mimeType: "text/markdown" },
  { kind: "file", artifactId: "a2", name: "two.md", mimeType: "text/markdown" },
];
const describe_ = { count: (n: string) => `${n} (count)`, size: (n: string) => `${n} (size)` };

beforeEach(() => get.mockReset());

it("reads every file block, in the message's own target", async () => {
  get.mockResolvedValue(b64("hi"));
  const { files, failed } = await fetchMessageFiles({ botId: "b" }, blocks);
  expect(files.map((f) => f.name)).toEqual(["one.md", "two.md"]);
  expect(failed).toEqual([]);
  expect(get).toHaveBeenCalledWith({ botId: "b", artifactId: "a1" });
});

it("reports a file that cannot be read and keeps the others", async () => {
  get.mockRejectedValueOnce(new Error("gone")).mockResolvedValueOnce(b64("hi"));
  const { files, failed } = await fetchMessageFiles({ botId: "b" }, blocks);
  expect(files.map((f) => f.name)).toEqual(["two.md"]);
  expect(failed).toEqual(["one.md"]);
});

it("enforces the attachment limit against what the composer holds now", () => {
  const file = (name: string) => new File(["x"], name, { type: "text/markdown" });
  const files = [file("a.md"), file("b.md")];
  expect(acceptAttachments(0, files, describe_).accepted).toHaveLength(2);
  const full = acceptAttachments(ATTACHMENT_MAX_COUNT - 1, files, describe_);
  expect(full.accepted.map((f) => f.name)).toEqual(["a.md"]);
  expect(full.skipped).toEqual(["b.md (count)"]);
});
