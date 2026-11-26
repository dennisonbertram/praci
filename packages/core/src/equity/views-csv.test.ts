import { describe, expect, it } from "vitest";
import { toCsv } from "./views-csv.js";

const columns = [
  { key: "name", label: "Name" },
  { key: "shares", label: "Shares" },
];

describe("toCsv", () => {
  it("writes a header and rows with CRLF line ends", () => {
    expect(toCsv(columns, [{ name: "Ada Example", shares: 1200n }])).toBe(
      "Name,Shares\r\nAda Example,1200\r\n",
    );
  });

  it("quotes commas, quotes and newlines, and leaves missing cells empty", () => {
    expect(toCsv(columns, [{ name: 'Fund, "A"\nII', shares: null }])).toBe(
      'Name,Shares\r\n"Fund, ""A""\nII",\r\n',
    );
  });

  it("neutralizes cells a spreadsheet would run as formulas, but keeps negative numbers", () => {
    const csv = toCsv(columns, [
      { name: "=HYPERLINK(1)", shares: "-12.5" },
      { name: "@SUM(A1)", shares: "+1" },
      { name: "-cmd", shares: -3 },
    ]);
    expect(csv).toBe("Name,Shares\r\n'=HYPERLINK(1),-12.5\r\n'@SUM(A1),'+1\r\n'-cmd,-3\r\n");
  });
});
