import { describe, expect, it } from "vitest";
import { parseMailSignals } from "./mail-signals.js";

/** Builds the multi-value header map the Gmail adapter passes in. */
function headers(entries: Array<[string, string]>): Map<string, string[]> {
  const map = new Map<string, string[]>();
  for (const [name, value] of entries) {
    const key = name.toLowerCase();
    map.set(key, [...(map.get(key) ?? []), value]);
  }
  return map;
}

const parse = (entries: Array<[string, string]>, labels: string[] = []) =>
  parseMailSignals(headers(entries), labels);

describe("parseMailSignals", () => {
  it("keeps https first, drops http, keeps mailto, caps at three", () => {
    const signals = parse([
      [
        "List-Unsubscribe",
        "<mailto:leave@lists.example.test?subject=unsub>, <http://plain.example.test/u>, <https://a.example.test/u/1>, <https://b.example.test/u/2>, <https://c.example.test/u/3>",
      ],
    ]);
    expect(signals.listUnsubscribe).toEqual([
      "https://a.example.test/u/1",
      "https://b.example.test/u/2",
      "https://c.example.test/u/3",
    ]);
    const mailtoOnly = parse([["List-Unsubscribe", "<mailto:leave@lists.example.test>"]]);
    expect(mailtoOnly.listUnsubscribe).toEqual(["mailto:leave@lists.example.test"]);
    expect(parse([]).listUnsubscribe).toEqual([]);
  });

  it("sets oneClick only for List-Unsubscribe=One-Click", () => {
    const base: Array<[string, string]> = [["List-Unsubscribe", "<https://a.example.test/u>"]];
    expect(parse([...base, ["List-Unsubscribe-Post", "List-Unsubscribe=One-Click"]]).oneClick).toBe(
      true,
    );
    expect(parse([...base, ["List-Unsubscribe-Post", "list-unsubscribe=one-click"]]).oneClick).toBe(
      true,
    );
    expect(parse([...base, ["List-Unsubscribe-Post", "something=else"]]).oneClick).toBe(false);
    expect(parse(base).oneClick).toBe(false);
  });

  it("reads List-Id, bulk precedence and Auto-Submitted", () => {
    expect(parse([["List-Id", "Weekly <weekly.lists.example.test>"]]).listId).toBe(
      "Weekly <weekly.lists.example.test>",
    );
    expect(parse([]).listId).toBeNull();
    for (const value of ["bulk", "list", "JUNK"])
      expect(parse([["Precedence", value]]).bulk).toBe(true);
    expect(parse([["Precedence", "first-class"]]).bulk).toBe(false);
    expect(parse([["Auto-Submitted", "auto-generated"]]).autoSubmitted).toBe(true);
    expect(parse([["Auto-Submitted", "no"]]).autoSubmitted).toBe(false);
    expect(parse([]).autoSubmitted).toBe(false);
  });

  it("reads dkim, spf and dmarc from the mx.google.com Authentication-Results and ignores another authserv-id", () => {
    const signals = parse([
      [
        "Authentication-Results",
        "mx.google.com; dkim=pass header.i=@news.example.test header.s=s1; spf=pass smtp.mailfrom=news.example.test; dmarc=pass header.from=news.example.test",
      ],
    ]);
    expect(signals.auth).toEqual({ dkim: "pass", spf: "pass", dmarc: "pass" });

    const forged = parse([
      ["Authentication-Results", "attacker.example.test; dkim=pass; spf=pass; dmarc=pass"],
    ]);
    expect(forged.auth).toEqual({ dkim: null, spf: null, dmarc: null });

    const mixed = parse([
      ["Authentication-Results", "attacker.example.test; dkim=pass"],
      ["Authentication-Results", "mx.google.com; dkim=fail; spf=pass; dmarc=fail"],
    ]);
    expect(mixed.auth).toEqual({ dkim: "fail", spf: "pass", dmarc: "fail" });
  });

  it("maps fail, softfail and permerror to fail, and absent, none and neutral to null", () => {
    const signals = parse([
      [
        "Authentication-Results",
        "mx.google.com; dkim=permerror header.d=a.example.test; spf=softfail smtp.mailfrom=a.example.test; dmarc=none",
      ],
    ]);
    expect(signals.auth).toEqual({ dkim: "fail", spf: "fail", dmarc: null });
    const neutral = parse([
      ["Authentication-Results", "mx.google.com; spf=neutral smtp.mailfrom=a.example.test"],
    ]);
    expect(neutral.auth).toEqual({ dkim: null, spf: null, dmarc: null });
  });

  it("takes dkim=pass when any signature passed", () => {
    const signals = parse([
      [
        "Authentication-Results",
        "mx.google.com; dkim=fail header.i=@a.example.test header.s=x; dkim=pass header.i=@b.example.test header.s=y",
      ],
    ]);
    expect(signals.auth.dkim).toBe("pass");
  });

  it("dkimCoversUnsubscribe is true when a passing signature lists both headers (folded, mixed case) and false otherwise", () => {
    const results = "mx.google.com; dkim=pass header.i=@news.example.test header.s=s1";
    const both = parse([
      ["Authentication-Results", results],
      [
        "DKIM-Signature",
        "v=1; a=rsa-sha256; d=News.Example.Test; s=s1;\r\n\th=From:Subject:List-Unsubscribe:\r\n List-Unsubscribe-Post:Date; bh=abc; b=xyz",
      ],
    ]);
    expect(both.dkimCoversUnsubscribe).toBe(true);

    const onlyOne = parse([
      ["Authentication-Results", results],
      ["DKIM-Signature", "v=1; d=news.example.test; s=s1; h=from:subject:list-unsubscribe; b=xyz"],
    ]);
    expect(onlyOne.dkimCoversUnsubscribe).toBe(false);

    // A second, covering signature from a domain that did not pass does not count.
    const notPassing = parse([
      ["Authentication-Results", results],
      [
        "DKIM-Signature",
        "v=1; d=other.example.test; s=s2; h=from:list-unsubscribe:list-unsubscribe-post; b=xyz",
      ],
    ]);
    expect(notPassing.dkimCoversUnsubscribe).toBe(false);

    // Two signatures: the later one covers both and its domain passed.
    const second = parse([
      ["Authentication-Results", results],
      ["DKIM-Signature", "v=1; d=other.example.test; s=s2; h=from; b=1"],
      [
        "DKIM-Signature",
        "v=1; d=news.example.test; s=s1; h=from:list-unsubscribe:list-unsubscribe-post; b=2",
      ],
    ]);
    expect(second.dkimCoversUnsubscribe).toBe(true);

    expect(
      parse([
        ["DKIM-Signature", "v=1; d=news.example.test; h=list-unsubscribe:list-unsubscribe-post"],
      ]).dkimCoversUnsubscribe,
    ).toBe(false);
  });

  it("reads header.d as well as header.i for the passing domain", () => {
    const signals = parse([
      ["Authentication-Results", "mx.google.com; dkim=pass header.d=news.example.test header.s=s1"],
      [
        "DKIM-Signature",
        "v=1; d=news.example.test; s=s1; h=list-unsubscribe:list-unsubscribe-post; b=x",
      ],
    ]);
    expect(signals.dkimCoversUnsubscribe).toBe(true);
  });

  it("maps the six label ids to category flags", () => {
    expect(parse([], []).categories).toEqual({
      spam: false,
      promotions: false,
      social: false,
      updates: false,
      forums: false,
      important: false,
    });
    expect(
      parse(
        [],
        [
          "SPAM",
          "CATEGORY_PROMOTIONS",
          "CATEGORY_SOCIAL",
          "CATEGORY_UPDATES",
          "CATEGORY_FORUMS",
          "IMPORTANT",
          "INBOX",
        ],
      ).categories,
    ).toEqual({
      spam: true,
      promotions: true,
      social: true,
      updates: true,
      forums: true,
      important: true,
    });
  });
});
