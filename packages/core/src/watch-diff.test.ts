import { describe, expect, it } from "vitest";
import { fingerprintText } from "./node/watch-fingerprint.js";
import {
  diffSnapshots,
  normalizePageText,
  stableJsonText,
  truncateSnapshot,
} from "./watch-diff.js";

describe("normalizePageText", () => {
  it("drops scripts, styles and comments, keeps text, decodes entities", () => {
    const html = `<html><head><style>p{color:red}</style><script>var a="<b>x</b>";</script></head>
      <body><!-- hidden --><h1>Pricing &amp; plans</h1><p>Pro:   $20&nbsp;/ mo &#8364; &#x41;</p>
      <noscript>enable js</noscript><ul><li>One</li><li>Two</li></ul></body></html>`;
    expect(normalizePageText(html)).toBe("Pricing & plans\nPro: $20 / mo € A\nOne\nTwo");
  });
  it("is deterministic and ignores whitespace-only changes", () => {
    expect(normalizePageText("<p>a   b</p>\n\n\n<p> c </p>")).toBe(
      normalizePageText("<p>a b</p><p>c</p>"),
    );
  });
  it("leaves unknown entities alone", () => {
    expect(normalizePageText("<p>&bogus; &#0;</p>")).toBe("&bogus; &#0;");
  });
});

describe("fingerprintText", () => {
  it("is a stable sha256 hex", () => {
    expect(fingerprintText("a")).toBe(
      "ca978112ca1bbdcafac231b39a23dc4da786eff8147c4e72b9807785afee48bb",
    );
  });
});

describe("truncateSnapshot", () => {
  it("keeps short text and cuts long text at a line when close to the limit", () => {
    expect(truncateSnapshot("abc", 10)).toBe("abc");
    expect(truncateSnapshot("aaaa\nbbbbbbb", 10)).toBe("aaaa\nbbbbb");
    expect(truncateSnapshot("aaaaaaaa\nbbbbbbb", 10)).toBe("aaaaaaaa");
  });
  it("defaults to 16384 characters", () => {
    expect(truncateSnapshot("x".repeat(20_000)).length).toBe(16_384);
  });
});

describe("diffSnapshots", () => {
  it("shows removed and added lines", () => {
    expect(diffSnapshots("a\nb\nc", "a\nB\nc\nd")).toBe("- b\n+ B\n+ d");
  });
  it("is empty when only order changed", () => {
    expect(diffSnapshots("a\nb", "b\na")).toBe("");
  });
  it("counts duplicate lines", () => {
    expect(diffSnapshots("a\na", "a")).toBe("- a");
  });
  it("handles an empty before", () => {
    expect(diffSnapshots("", "x")).toBe("+ x");
  });
  it("truncates with a count of the rest", () => {
    const after = Array.from({ length: 10 }, (_, i) => `line number ${i}`).join("\n");
    const out = diffSnapshots("", after, 50);
    expect(out.split("\n")).toEqual([
      "+ line number 0",
      "+ line number 1",
      "+ line number 2",
      "…7 more changes",
    ]);
  });
});

describe("stableJsonText", () => {
  it("gives equal text for equal data in any key order, one line per value", () => {
    const a = stableJsonText({ b: 1, a: { d: [1, { z: 1, y: 2 }], c: "x" } });
    expect(a).toBe(stableJsonText({ a: { c: "x", d: [1, { y: 2, z: 1 }] }, b: 1 }));
    expect(diffSnapshots(a, a.replace('"b": 1', '"b": 2'))).toBe('-   "b": 1\n+   "b": 2');
  });
});
