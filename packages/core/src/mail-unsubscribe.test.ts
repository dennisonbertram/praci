import type { MailSignals } from "@rakazo/contracts";
import { describe, expect, it } from "vitest";
import { parseUnsubscribeMailto, planUnsubscribe } from "./mail-unsubscribe.js";

const quiet: MailSignals = {
  listUnsubscribe: [],
  oneClick: false,
  listId: null,
  bulk: false,
  autoSubmitted: false,
  auth: { dkim: "pass", spf: "pass", dmarc: "pass" },
  dkimCoversUnsubscribe: false,
  categories: {
    spam: false,
    promotions: false,
    social: false,
    updates: false,
    forums: false,
    important: false,
  },
};
const https = "https://lists.example.test/u/1";
const mailto = "mailto:unsub@lists.example.test?subject=remove";
const full: MailSignals = {
  ...quiet,
  listUnsubscribe: [https, mailto],
  oneClick: true,
  dkimCoversUnsubscribe: true,
};

describe("planUnsubscribe", () => {
  it("is one click only when the post header, https, DKIM coverage and a DKIM pass all hold", () => {
    expect(planUnsubscribe(full, false)).toEqual({ method: "one_click", url: https });
  });

  it.each([
    ["no List-Unsubscribe-Post", { oneClick: false }],
    ["DKIM not covering the headers", { dkimCoversUnsubscribe: false }],
    ["no DKIM pass", { auth: { dkim: null, spf: "pass", dmarc: "pass" } as MailSignals["auth"] }],
  ])("falls back to the link without %s", (_name, patch) => {
    expect(planUnsubscribe({ ...full, ...patch }, false)).toEqual({ method: "link", url: https });
  });

  it("falls back to the link when there is no https target but mailto", () => {
    expect(planUnsubscribe({ ...full, listUnsubscribe: [mailto] }, false)).toEqual({
      method: "mailto",
      target: mailto,
    });
  });

  it("does not take an http link", () => {
    expect(
      planUnsubscribe({ ...full, listUnsubscribe: ["http://lists.example.test/u"] }, false),
    ).toEqual({ method: "none" });
  });

  it("is none without signals or targets", () => {
    expect(planUnsubscribe(null, false)).toEqual({ method: "none" });
    expect(planUnsubscribe(quiet, false)).toEqual({ method: "none" });
  });

  it("refuses spam, failed authentication and flagged senders", () => {
    const spam = { ...full, categories: { ...full.categories, spam: true } };
    expect(planUnsubscribe(spam, false)).toEqual({ method: "refused", reason: "spam" });
    expect(planUnsubscribe(full, true)).toEqual({ method: "refused", reason: "spam" });
    for (const auth of [
      { dkim: "pass", spf: "fail", dmarc: "pass" },
      { dkim: "fail", spf: "pass", dmarc: "pass" },
      { dkim: "pass", spf: "pass", dmarc: "fail" },
    ] as MailSignals["auth"][]) {
      expect(planUnsubscribe({ ...full, auth }, false)).toEqual({
        method: "refused",
        reason: "auth_failed",
      });
    }
  });
});

describe("parseUnsubscribeMailto", () => {
  it("reads the address, subject and body", () => {
    expect(
      parseUnsubscribeMailto("mailto:unsub@lists.example.test?subject=Stop%20me&body=please"),
    ).toEqual({ to: "unsub@lists.example.test", subject: "Stop me", body: "please" });
  });

  it("defaults the subject and body", () => {
    expect(parseUnsubscribeMailto("mailto:unsub@lists.example.test")).toEqual({
      to: "unsub@lists.example.test",
      subject: "unsubscribe",
      body: "unsubscribe",
    });
  });

  it("refuses several recipients and invalid targets", () => {
    expect(parseUnsubscribeMailto("mailto:a@example.test,b@example.test")).toBeNull();
    expect(parseUnsubscribeMailto("mailto:not-an-address")).toBeNull();
    expect(parseUnsubscribeMailto("https://example.test/u")).toBeNull();
    expect(parseUnsubscribeMailto("mailto:")).toBeNull();
  });

  it("ignores cc, bcc and extra to parameters", () => {
    const parsed = parseUnsubscribeMailto(
      "mailto:u@example.test?cc=x@example.test&bcc=y@example.test&to=z@example.test",
    );
    expect(parsed).toEqual({ to: "u@example.test", subject: "unsubscribe", body: "unsubscribe" });
  });

  it("strips line breaks and caps lengths", () => {
    const parsed = parseUnsubscribeMailto(
      `mailto:u@example.test?subject=${encodeURIComponent(`a\r\nBcc: v@example.test${"x".repeat(300)}`)}&body=${"y".repeat(900)}`,
    );
    expect(parsed?.subject).not.toMatch(/[\r\n]/);
    expect(parsed?.subject.length).toBe(200);
    expect(parsed?.body.length).toBe(500);
  });
});
