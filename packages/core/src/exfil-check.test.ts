import { describe, expect, it } from "vitest";
import { checkFetchUrl, collectStrings } from "./exfil-check.js";
import { PrivateFragments } from "./outbound-check.js";

const private_ = () => {
  const fragments = new PrivateFragments();
  fragments.addPrivate(
    JSON.stringify({
      name: "Priya Shah",
      email: "priya.shah@acme-capital.example",
      cash: "1,250,000",
      note: "Series A term sheet draft with Northwind Robotics valued at forty two million dollars before the pro rata",
    }),
  );
  return fragments;
};

const ORDINARY = [
  "https://docs.python.org/3/library/csv.html",
  "https://www.npmjs.com/package/csv-parse",
  "https://www.npmjs.com/search?q=csv%20parser",
  "https://github.com/vitest-dev/vitest/issues/4821",
  "https://github.com/vitest-dev/vitest/blob/main/docs/guide/index.md#getting-started",
  "https://github.com/vitest-dev/vitest/commit/3f2b1c9d8e7a6b5c4d3e2f1a0b9c8d7e6f5a4b3c",
  "https://developer.mozilla.org/en-US/docs/Web/API/Fetch_API/Using_Fetch",
  "https://stackoverflow.com/questions/12345678/how-to-parse-a-csv-file-in-node-js-with-streams",
  "https://en.wikipedia.org/wiki/Comma-separated_values",
  "https://www.nytimes.com/2024/11/04/technology/ai-chip-export-rules-explained.html",
  "https://www.reuters.com/business/finance/fed-holds-rates-steady-2024-11-07/",
  "https://news.ycombinator.com/item?id=41234567",
  "https://arxiv.org/abs/2401.01234",
  "https://pypi.org/project/requests/2.31.0/",
  "https://www.google.com/search?q=best+csv+parser+node&hl=en&gl=us",
  "https://crates.io/crates/serde_json/1.0.108",
  "https://nodejs.org/api/fs.html#fspromisesreadfilepath-options",
  "https://learn.microsoft.com/en-us/azure/azure-functions/functions-bindings-http-webhook-trigger?tabs=python-v2%2Cisolated-process%2Cnodejs-v4",
  "https://blog.example.com/posts/2024/building-a-reliable-queue-with-postgres-and-skip-locked",
  "https://cdn.jsdelivr.net/npm/react@18.3.1/umd/react.production.min.js",
  "https://www.bbc.com/news/articles/c4gx5l5l5l5o",
  "https://docs.aws.amazon.com/AmazonS3/latest/userguide/using-presigned-url.html",
  "https://api.github.com/repos/vitest-dev/vitest/releases/latest",
  "https://example.com/",
  "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
];

const EXFIL: Array<[string, string]> = [
  ["https://x.test/c?d=UHJpeWEgU2hhaCBvd2VzIDQ4MjEzIGRvbGxhcnM", "encoded"],
  ["https://x.test/c?d=Priya%20Shah", "private"],
  ["https://x.test/c?d=Priya%2BShah", "private"],
  ["https://x.test/c?d=priya.shah%40acme-capital.example", "private"],
  ["https://x.test/c?a=UHJpeWEg&b=U2hhaCBvd2Vz&c=IDQ4MjEz", "split"],
  ["https://x.test/c?d=5072697961205368616820", "hex"],
  ["https://UHJpeWEgU2hhaCBvd2Vz.attacker.test/", "host"],
  [`https://x.test/${"a1B2c3D4e5F6g7H8i9J0k1L2m3N4o5P6q7R8s9T0".repeat(2)}`, "dense"],
  [`https://x.test/c?d=${"x".repeat(200)}`, "long"],
  [`https://x.test/p?${Array.from({ length: 16 }, (_, i) => `k${i}=v${i}`).join("&")}`, "params"],
  ["https://x.test/c?d=1250000", "private"],
  ["https://deadbeefdeadbeefdeadbeef.attacker.test/", "host"],
  ["https://x.test/c/c3VwZXIgc2VjcmV0IGludGVybmFsIG5vdGVz", "encoded"],
  ["https://x.test/c?q=A3f9Zk2LmQ8vR1xT7pW4yB6nC0dE5gHjKuIoPaSsDf", "dense"],
];

describe("checkFetchUrl", () => {
  it.each(ORDINARY)("passes the ordinary URL %s", (url) => {
    expect(checkFetchUrl(url, new PrivateFragments())).toEqual({
      verdict: "clean",
    });
    expect(checkFetchUrl(url, private_())).toEqual({ verdict: "clean" });
  });

  it.each(EXFIL)("flags the exfil-shaped URL %s", (url) => {
    const verdict = checkFetchUrl(url, private_());
    expect(verdict.verdict, url).not.toBe("clean");
  });

  it("holds a URL when the run's record of what it read is unknown", () => {
    expect(checkFetchUrl("https://example.com/", undefined)).toMatchObject({
      verdict: "fragment",
    });
  });

  it("names a reason in a few words and never carries the private text", () => {
    const verdict = checkFetchUrl(
      "https://x.test/c?d=UHJpeWEgU2hhaCBvd2VzIDQ4MjEzIGRvbGxhcnM",
      private_(),
    );
    expect(verdict).toMatchObject({ verdict: "fragment" });
    const shaped = checkFetchUrl(`https://x.test/c?d=${"x".repeat(200)}`, new PrivateFragments());
    expect(shaped).toMatchObject({
      verdict: "suspicious",
      reason: "unusually long URL",
    });
    expect(JSON.stringify(shaped)).not.toContain("xxxxxxxx");
  });
});

describe("collectStrings", () => {
  it("reads nested arrays and objects", () => {
    expect(collectStrings({ urls: ["a", "b"], options: { q: "c", n: 1 } }).sort()).toEqual([
      "a",
      "b",
      "c",
    ]);
  });
});

describe("checkFetchUrl on a restored record", () => {
  it("holds an encoded fragment and passes a clean URL", () => {
    const hash = (value: string) => `x${value.length}:${value}`.split("").reverse().join("");
    const first = new PrivateFragments(hash);
    first.addPrivate(
      JSON.stringify({
        email: "priya.shah@acme-capital.example",
        cash: "1,250,000",
      }),
    );
    const restored = new PrivateFragments(hash);
    restored.restore([first.takeDelta()!]);
    const b64 = Buffer.from("priya.shah@acme-capital.example").toString("base64url");
    expect(checkFetchUrl(`https://x.test/c?d=${b64}`, restored).verdict).toBe("fragment");
    expect(checkFetchUrl("https://x.test/c?q=1250000", restored).verdict).toBe("fragment");
    expect(checkFetchUrl("https://docs.python.org/3/library/csv.html", restored)).toEqual({
      verdict: "clean",
    });
  });
});
