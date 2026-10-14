import { describe, expect, it } from "vitest";
import { parseRecipient, splitEntries, takeEntries } from "./recipients";

describe("takeEntries", () => {
  it("turns text before a comma into an entry and keeps the tail", () => {
    expect(takeEntries("a@x.test, b@x.test, c@", [])).toEqual({
      added: ["a@x.test", "b@x.test"],
      rest: " c@",
    });
  });

  it("splits a pasted list on commas, semicolons and line breaks, and finishes the tail", () => {
    expect(takeEntries("a@x.test; b@x.test\nc@x.test,\r\n d@x.test ", [], true)).toEqual({
      added: ["a@x.test", "b@x.test", "c@x.test", "d@x.test"],
      rest: "",
    });
  });

  it("drops blanks and repeats, ignoring case and what is already added", () => {
    expect(takeEntries("A@x.test,,a@x.test, b@x.test", ["B@x.test"], true)).toEqual({
      added: ["A@x.test"],
      rest: "",
    });
  });

  it("keeps invalid text as an entry so it shows as an error chip", () => {
    expect(takeEntries("not-an-address,", [])).toEqual({ added: ["not-an-address"], rest: "" });
  });
});

describe("splitEntries", () => {
  it("does not split inside quotes or angle brackets", () => {
    expect(splitEntries('"Shah, Priya" <p@x.test>, Sam <s@x.test>')).toEqual([
      '"Shah, Priya" <p@x.test>',
      " Sam <s@x.test>",
    ]);
  });
});

describe("parseRecipient", () => {
  it("reads a bare address and Name <address>", () => {
    expect(parseRecipient(" a@x.test ")).toEqual({
      entry: "a@x.test",
      name: "",
      address: "a@x.test",
      valid: true,
    });
    expect(parseRecipient('"Shah, Priya" <p@x.test>')).toMatchObject({
      name: "Shah, Priya",
      address: "p@x.test",
      valid: true,
    });
  });

  it("marks bad addresses invalid", () => {
    for (const bad of ["plain", "a@b", "a b@x.test", "Name <nope>", "a@@x.test"])
      expect(parseRecipient(bad).valid).toBe(false);
  });
});
