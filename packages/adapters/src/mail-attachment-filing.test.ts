import { describe, expect, it } from "vitest";
import type { FilingCandidate } from "./mail-attachment-filing.js";
import { isAutoFileAttachment, isAutoFileMessage } from "./mail-attachment-filing.js";

const part = (over: Partial<Parameters<typeof isAutoFileAttachment>[0]> = {}) => ({
  id: "a",
  filename: "report.pdf",
  mimeType: "application/pdf",
  size: 20_000,
  inline: false,
  ...over,
});

describe("isAutoFileAttachment", () => {
  it("accepts document types", () => {
    for (const [filename, mimeType] of [
      ["a.pdf", "application/pdf"],
      ["a.docx", "application/vnd.openxmlformats-officedocument.wordprocessingml.document"],
      ["a.doc", "application/msword"],
      ["a.xlsx", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"],
      ["a.xls", "application/vnd.ms-excel"],
      ["a.csv", "text/csv"],
      ["a.pptx", "application/vnd.openxmlformats-officedocument.presentationml.presentation"],
      ["a.zip", "application/zip"],
      ["a.pdf", "application/octet-stream"],
    ] as const) {
      expect(isAutoFileAttachment(part({ filename, mimeType })), filename).toBe(true);
    }
  });

  it("skips inline parts, images, calendar invites and files under 10 KB", () => {
    expect(isAutoFileAttachment(part({ inline: true }))).toBe(false);
    expect(isAutoFileAttachment(part({ filename: "logo.png", mimeType: "image/png" }))).toBe(false);
    expect(isAutoFileAttachment(part({ filename: "i.ics", mimeType: "text/calendar" }))).toBe(
      false,
    );
    expect(isAutoFileAttachment(part({ size: 10 * 1024 - 1 }))).toBe(false);
    expect(
      isAutoFileAttachment(part({ filename: "a.bin", mimeType: "application/octet-stream" })),
    ).toBe(false);
  });
});

const message = (over: Partial<FilingCandidate> = {}): FilingCandidate => ({
  fromAddress: "ann@example.test",
  toAddresses: ["me@example.test"],
  ccAddresses: [],
  fromSelf: false,
  isSpam: false,
  pile: "important",
  category: null,
  signals: null,
  ...over,
});

describe("isAutoFileMessage", () => {
  it("accepts ordinary received mail", () => {
    expect(isAutoFileMessage(message())).toBe(true);
  });

  it("skips spam, newsletters, bulk and no-reply senders", () => {
    expect(isAutoFileMessage(message({ isSpam: true }))).toBe(false);
    expect(isAutoFileMessage(message({ pile: "newsletters" }))).toBe(false);
    expect(isAutoFileMessage(message({ category: "bulk" }))).toBe(false);
    expect(isAutoFileMessage(message({ fromAddress: "No-Reply@example.test" }))).toBe(false);
    expect(isAutoFileMessage(message({ fromAddress: "donotreply@example.test" }))).toBe(false);
  });

  it("includes mail the owner sent to others and skips mail sent only to themselves", () => {
    const sent = { fromSelf: true, fromAddress: "me@example.test", pile: null };
    expect(isAutoFileMessage(message({ ...sent, toAddresses: ["ann@example.test"] }))).toBe(true);
    expect(isAutoFileMessage(message({ ...sent, toAddresses: ["me@example.test"] }))).toBe(false);
    expect(isAutoFileMessage(message({ ...sent, toAddresses: [] }))).toBe(false);
  });
});
