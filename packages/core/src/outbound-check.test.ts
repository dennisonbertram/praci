import { describe, expect, it } from "vitest";
import { checkOutbound, PrivateFragments } from "./outbound-check.js";

const mail = JSON.stringify({
  messages: [
    {
      from: "Priya Shah <priya.shah@halcyon-ventures.example>",
      subject: "Seed allocation",
      body: "We will wire $1,250,000 once the side letter is signed by Friday afternoon at the latest.",
    },
  ],
});

function withMail(extra?: (f: PrivateFragments) => void) {
  const fragments = new PrivateFragments();
  fragments.addPrivate(mail);
  extra?.(fragments);
  return fragments;
}

describe("checkOutbound: what is caught", () => {
  it("passes text that repeats nothing private", () => {
    expect(checkOutbound({ text: "We open at 9am on weekdays.", fragments: withMail() })).toEqual({
      allow: true,
    });
  });

  it("holds an email address, whatever its case or wrapping", () => {
    for (const text of [
      "Reach priya.shah@halcyon-ventures.example",
      "PRIYA.SHAH@HALCYON-VENTURES.EXAMPLE",
      "[email](mailto:Priya.Shah@Halcyon-Ventures.example)",
      "<priya.shah@halcyon-ventures.example>",
    ]) {
      expect(checkOutbound({ text, fragments: withMail() })).toMatchObject({ allow: false });
    }
  });

  it("holds a number however it is written", () => {
    for (const text of ["$1,250,000", "1250000 dollars", "1 250 000", "€1,250,000.00"]) {
      expect(checkOutbound({ text, fragments: withMail() }), text).toMatchObject({ allow: false });
    }
  });

  it("holds a name from a header or a name field, in any case and spacing", () => {
    for (const text of ["priya   shah leads it", "Thanks, PRIYA SHAH."]) {
      expect(checkOutbound({ text, fragments: withMail() }), text).toMatchObject({
        allow: false,
        kinds: expect.arrayContaining(["name"]),
      });
    }
    const crm = new PrivateFragments();
    crm.addPrivate(
      JSON.stringify({ investors: [{ name: "Halcyon Ventures", holder: "Dana Okafor" }] }),
    );
    expect(checkOutbound({ text: "dana okafor holds 3%", fragments: crm })).toMatchObject({
      allow: false,
    });
  });

  it("holds a copied passage of eight words", () => {
    const text = "Re: we will wire the money once the side letter is signed by Friday afternoon";
    expect(checkOutbound({ text, fragments: withMail() })).toMatchObject({
      allow: false,
      kinds: expect.arrayContaining(["passage"]),
    });
  });
});

describe("checkOutbound: what is not caught", () => {
  it.each([
    ["a paraphrase", "A fund led the seed round and will pay after the paperwork."],
    ["a spelled-out number", "one million two hundred fifty thousand dollars"],
    ["a scaled number", "$1.25M or $1250k"],
    ["an obfuscated address", "priya dot shah at halcyon-ventures dot example"],
    ["a short single-word name", "Priya says hello"],
    ["a bare year", "Founded in 2026"],
  ])("lets through %s", (_label, text) => {
    expect(checkOutbound({ text, fragments: withMail() })).toEqual({ allow: true });
  });
});

describe("public text", () => {
  it("never flags what the person wrote themselves", () => {
    const fragments = withMail((f) =>
      f.addPublic("Is Priya Shah at priya.shah@halcyon-ventures.example the right contact?"),
    );
    expect(
      checkOutbound({ text: "Yes, priya.shah@halcyon-ventures.example, Priya Shah.", fragments }),
    ).toEqual({ allow: true });
    // A different private fragment is still held.
    expect(checkOutbound({ text: "She wires $1,250,000.", fragments })).toMatchObject({
      allow: false,
    });
  });
});

describe("a plain-text relay from another internal bot", () => {
  it("keeps names that lost their structure, so they cannot be repeated to an external bot", () => {
    const relay = new PrivateFragments();
    relay.addPrivateRelay("Priya Shah at Halcyon Ventures committed the seed round last week.");
    for (const text of ["Priya Shah leads it", "talk to PRIYA SHAH", "Halcyon Ventures is in"]) {
      expect(checkOutbound({ text, fragments: relay }), text).toMatchObject({ allow: false });
    }
    expect(checkOutbound({ text: "We open at 9am.", fragments: relay })).toEqual({ allow: true });
    // Structured addPrivate alone would have missed the relayed name.
    const plain = new PrivateFragments();
    plain.addPrivate("Priya Shah at Halcyon Ventures committed the seed round last week.");
    expect(checkOutbound({ text: "Priya Shah leads it", fragments: plain })).toEqual({
      allow: true,
    });
  });
});

describe("names that were hidden", () => {
  it("reads JSON carried inside a string field, like an MCP envelope", () => {
    const envelope = new PrivateFragments();
    envelope.addPrivate(
      JSON.stringify({
        content: [{ type: "text", text: JSON.stringify({ investors: [{ name: "Priya Shah" }] }) }],
      }),
    );
    expect(checkOutbound({ text: "Priya Shah is in", fragments: envelope })).toMatchObject({
      allow: false,
      kinds: ["name"],
    });
    expect(checkOutbound({ text: "We open at 9am.", fragments: envelope })).toEqual({
      allow: true,
    });
  });

  it("keeps the name inside a longer capitalized span of a relay", () => {
    const relay = new PrivateFragments();
    relay.addPrivateRelay("Contact Priya Shah for details about the round.");
    expect(checkOutbound({ text: "Priya Shah", fragments: relay })).toMatchObject({ allow: false });
    expect(checkOutbound({ text: "Contact Priya Shah", fragments: relay })).toMatchObject({
      allow: false,
    });
  });
});
