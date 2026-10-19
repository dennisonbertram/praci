import { describe, expect, it } from "vitest";
import { dataRoomReferenceLine, splitDataRoomReferences } from "./data-room-references.js";

describe("splitDataRoomReferences", () => {
  it("splits the trailing lines the server appends from the person's words", () => {
    const text = `Please summarise these.\n\n${dataRoomReferenceLine({ id: "itm_1", name: "A  b.pdf" })}\n${dataRoomReferenceLine({ id: "itm_2", name: "C.csv" })}`;
    expect(splitDataRoomReferences(text)).toEqual({
      body: "Please summarise these.",
      refs: [
        { id: "itm_1", name: "A b.pdf" },
        { id: "itm_2", name: "C.csv" },
      ],
    });
  });

  it("handles a message that is only references", () => {
    expect(splitDataRoomReferences("Data room item x1: n.txt")).toEqual({
      body: "",
      refs: [{ id: "x1", name: "n.txt" }],
    });
  });

  it("leaves ordinary text, mid-text lines and unseparated lines alone", () => {
    for (const text of [
      "hello",
      "Data room item x1: n.txt\n\nand then more",
      "I wrote\nData room item x1: n.txt",
      "Data room item : n.txt",
      "see Data room item x1: n.txt",
    ]) {
      expect(splitDataRoomReferences(text)).toEqual({ body: text, refs: [] });
    }
  });
});
