import { expect, it, vi } from "vitest";
import { createCommandBuffer } from "./terminal-command-buffer";

function feed(buffer: (data: string) => void, ...chunks: string[]) {
  for (const chunk of chunks) buffer(chunk);
}

it("reports a typed line on Enter and applies Backspace", () => {
  const onCommand = vi.fn();
  const buffer = createCommandBuffer(onCommand);
  feed(buffer, "l", "s", " ", "-x", "\x7f", "a", "\r");
  expect(onCommand).toHaveBeenCalledWith("ls -a");
});

it("ignores empty lines, Ctrl-C and lines edited with arrow keys", () => {
  const onCommand = vi.fn();
  const buffer = createCommandBuffer(onCommand);
  feed(buffer, "\r", "rm x", "\x03", "\r", "echo hi", "\x1b[A", "\r");
  expect(onCommand).not.toHaveBeenCalled();
});

it("splits a pasted block into lines", () => {
  const onCommand = vi.fn();
  createCommandBuffer(onCommand)("cd app\rnpm test\r");
  expect(onCommand.mock.calls).toEqual([["cd app"], ["npm test"]]);
});

it("does not record what is typed at a password prompt", () => {
  const onCommand = vi.fn();
  const buffer = createCommandBuffer(onCommand, () => "[sudo] password for user: ");
  feed(buffer, "hunter2", "\r");
  expect(onCommand).not.toHaveBeenCalled();
});
