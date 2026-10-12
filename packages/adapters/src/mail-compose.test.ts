import { type MailMessage, MailProviderError } from "@rakazo/adapter-kit";
import { describe, expect, it } from "vitest";
import { decodeEncodedWords } from "./gmail-mail-provider.js";
import { buildRawMessage, parseRecipients, replyPrefill } from "./mail-compose.js";
import { parseRawMime } from "./mime-parse.js";

const alice = { name: "Alice Example", address: "alice@example.test" };
const priya = { name: "Priya Shah", address: "priya@example.test" };
const base = { to: [priya], cc: [], bcc: [], subject: "Hello", text: "Hi Priya" };

const invalid = (run: () => unknown) => {
  try {
    run();
  } catch (error) {
    expect(error).toBeInstanceOf(MailProviderError);
    expect((error as MailProviderError).kind).toBe("invalid");
    return;
  }
  throw new Error("expected the message to be rejected");
};

describe("buildRawMessage", () => {
  it("writes recipients, subject and threading headers with CRLF line ends", () => {
    const raw = buildRawMessage({
      ...base,
      cc: [alice],
      bcc: [{ address: "hidden@example.test" }],
      subject: "Re: Contract renewal",
      inReplyTo: "<a-01@mail.example.test>",
      references: "<root@mail.example.test> <a-01@mail.example.test>",
    });
    const mime = parseRawMime(raw);
    expect(mime.header("To")).toBe("Priya Shah <priya@example.test>");
    expect(mime.header("Cc")).toBe("Alice Example <alice@example.test>");
    expect(mime.header("Bcc")).toBe("hidden@example.test");
    expect(mime.header("Subject")).toBe("Re: Contract renewal");
    expect(mime.header("In-Reply-To")).toBe("<a-01@mail.example.test>");
    expect(mime.header("References")).toBe("<root@mail.example.test> <a-01@mail.example.test>");
    expect(mime.header("MIME-Version")).toBe("1.0");
    expect(raw).not.toMatch(/[^\r]\n/);
  });

  it("sends text and HTML as multipart/alternative", () => {
    const mime = parseRawMime(buildRawMessage(base));
    expect(mime.header("Content-Type")).toMatch(/^multipart\/alternative; boundary=/);
    expect(mime.types).toEqual(["multipart/alternative", "text/plain", "text/html"]);
    expect(mime.text).toBe("Hi Priya");
  });

  it("escapes the HTML part and keeps line breaks and indentation", () => {
    const mime = parseRawMime(
      buildRawMessage({ ...base, text: '<script>alert("x")</script> & more\nline two\n\n  indented' }),
    );
    expect(mime.html).not.toContain("<script>");
    expect(mime.html).toContain("&lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt; &amp; more");
    expect(mime.html).toMatch(/more<br>\s*line two<br>\s*<br>\s*(&nbsp;| )+indented/);
    // The plain part keeps the text exactly, with CRLF line ends on the wire.
    expect(mime.text?.replace(/\r\n/g, "\n")).toBe(
      '<script>alert("x")</script> & more\nline two\n\n  indented',
    );
  });

  it("encodes non-ASCII subjects and names as RFC 2047 words of at most 75 characters", () => {
    const subject = "Réunion à Zürich — 请确认日程安排 and a long enough tail to need several encoded words";
    const raw = buildRawMessage({
      ...base,
      to: [{ name: "Zoë Ångström", address: "zoe@example.test" }],
      subject,
    });
    const mime = parseRawMime(raw);
    expect(raw).not.toMatch(/Subject:[^\r\n]*[^\x20-\x7e\r\n]/);
    expect(decodeEncodedWords(mime.header("Subject") as string)).toBe(subject);
    for (const word of (mime.header("Subject") as string).match(/=\?UTF-8\?B\?[^?]*\?=/g) ?? []) {
      expect(word.length).toBeLessThanOrEqual(75);
    }
    expect(decodeEncodedWords(mime.header("To") as string)).toBe("Zoë Ångström <zoe@example.test>");
    expect(mime.text).toBe("Hi Priya");
  });

  it("quotes display names that contain commas or quotes", () => {
    const mime = parseRawMime(
      buildRawMessage({ ...base, to: [{ name: 'Doe, "JD" John', address: "jd@example.test" }] }),
    );
    expect(mime.header("To")).toBe('"Doe, \\"JD\\" John" <jd@example.test>');
  });

  it("rejects line breaks and control characters in any header value", () => {
    invalid(() => buildRawMessage({ ...base, subject: "Hi\r\nBcc: evil@example.test" }));
    invalid(() => buildRawMessage({ ...base, subject: "Hi\nthere" }));
    invalid(() => buildRawMessage({ ...base, subject: "Hi\u0000there" }));
    invalid(() => buildRawMessage({ ...base, to: [{ name: "A\r\nBcc: x@y.test", address: "a@example.test" }] }));
    invalid(() => buildRawMessage({ ...base, to: [{ address: "a@example.test\r\nBcc: x@y.test" }] }));
    invalid(() => buildRawMessage({ ...base, inReplyTo: "<a@b.test>\r\nBcc: x@y.test" }));
    invalid(() => buildRawMessage({ ...base, references: "<a@b.test>\nBcc: x@y.test" }));
  });

  it("rejects malformed addresses and messages with no recipient", () => {
    for (const address of ["plain", "a@", "@b.test", "a b@example.test", "a@exam ple.test", "a@b", "a@b.test,c@d.test", "<a@b.test>", "ü@example.test"]) {
      invalid(() => buildRawMessage({ ...base, to: [{ address }] }));
    }
    invalid(() => buildRawMessage({ ...base, to: [], cc: [], bcc: [] }));
  });

  it("limits the recipient count", () => {
    const many = Array.from({ length: 101 }, (_, i) => ({ address: `p${i}@example.test` }));
    invalid(() => buildRawMessage({ ...base, to: many }));
  });
});

describe("parseRecipients", () => {
  it("splits on commas outside quotes and reads names", () => {
    expect(
      parseRecipients('Ann <ann@example.test>, "Doe, John" <jd@example.test>; bob@example.test'),
    ).toEqual([
      { name: "Ann", address: "ann@example.test" },
      { name: "Doe, John", address: "jd@example.test" },
      { address: "bob@example.test" },
    ]);
  });

  it("returns nothing for blank text and rejects an entry that is not an address", () => {
    expect(parseRecipients("  ")).toEqual([]);
    invalid(() => parseRecipients("ann@example.test, nobody"));
    invalid(() => parseRecipients("ann@example.test\r\nBcc: x@y.test"));
  });
});

const original = (extra: Partial<MailMessage> = {}): MailMessage => ({
  id: "a-05",
  threadId: "t-offsite",
  date: "2026-09-23T15:04:05.000Z",
  from: priya,
  to: [alice],
  cc: [{ name: "Dev", address: "dev@example.test" }],
  replyTo: [],
  subject: "Team offsite plans",
  snippet: "",
  unread: false,
  labelIds: ["INBOX"],
  text: "Offsite is on the 14th.\nBring a laptop.",
  truncated: false,
  attachments: [],
  ...extra,
});

describe("replyPrefill", () => {
  it("replies to the sender with a Re: subject and a quoted original", () => {
    const out = replyPrefill(original(), "reply", "alice@example.test");
    expect(out.to).toBe("Priya Shah <priya@example.test>");
    expect(out.cc).toBe("");
    expect(out.subject).toBe("Re: Team offsite plans");
    expect(out.body.startsWith("\n\nOn ")).toBe(true);
    expect(out.body).toContain("Priya Shah <priya@example.test> wrote:");
    expect(out.body).toContain("> Offsite is on the 14th.\n> Bring a laptop.");
  });

  it("replies to Reply-To when the sender set one", () => {
    const out = replyPrefill(
      original({ replyTo: [{ address: "team-replies@example.test" }] }),
      "reply",
      "alice@example.test",
    );
    expect(out.to).toBe("team-replies@example.test");
  });

  it("does not stack Re: prefixes", () => {
    expect(replyPrefill(original({ subject: "RE: Plans" }), "reply", null).subject).toBe("RE: Plans");
    expect(replyPrefill(original({ subject: "re: Plans" }), "reply", null).subject).toBe("re: Plans");
  });

  it("reply all keeps the other recipients and leaves out the user's own address in any case", () => {
    const out = replyPrefill(
      original({
        to: [alice, { address: "Carol@Example.test" }],
        cc: [{ name: "Dev", address: "dev@example.test" }, { address: "ALICE@example.test" }, { address: "carol@example.test" }],
      }),
      "replyAll",
      "alice@example.test",
    );
    expect(out.to).toBe("Priya Shah <priya@example.test>, Carol@Example.test");
    expect(out.cc).toBe("Dev <dev@example.test>");
  });

  it("reply all to a message the user sent addresses the original recipients", () => {
    const sent = original({ from: alice, to: [priya], cc: [] });
    const out = replyPrefill(sent, "replyAll", "alice@example.test");
    expect(out.to).toBe("Priya Shah <priya@example.test>");
  });

  it("forwards with an Fwd: subject, no recipients and the original quoted with its headers", () => {
    const out = replyPrefill(original(), "forward", "alice@example.test");
    expect(out.to).toBe("");
    expect(out.cc).toBe("");
    expect(out.subject).toBe("Fwd: Team offsite plans");
    expect(out.body).toContain("---------- Forwarded message ---------");
    expect(out.body).toContain("From: Priya Shah <priya@example.test>");
    expect(out.body).toContain("Subject: Team offsite plans");
    expect(out.body).toContain("To: Alice Example <alice@example.test>");
    expect(out.body).toContain("Cc: Dev <dev@example.test>");
    expect(out.body).toContain("Offsite is on the 14th.\nBring a laptop.");
    expect(replyPrefill(original({ subject: "Fwd: Plans" }), "forward", null).subject).toBe("Fwd: Plans");
  });
});
