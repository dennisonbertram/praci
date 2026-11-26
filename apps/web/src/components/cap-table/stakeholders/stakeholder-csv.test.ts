import { expect, it } from "vitest";
import { csvDate, csvRecords, parseCsv, toCsv } from "./stakeholder-csv";

it("parses quotes, commas, newlines, CRLF and a BOM", () => {
  expect(parseCsv('﻿a,b\r\n"x, y","say ""hi"""\n"two\nlines",z\n\n')).toEqual([
    ["a", "b"],
    ["x, y", 'say "hi"'],
    ["two\nlines", "z"],
  ]);
});

it("writes what it reads", () => {
  const rows = [
    ["Name", "Note"],
    ["Ada", 'a "quoted", line'],
  ];
  expect(parseCsv(toCsv(rows))).toEqual(rows);
});

it("keys records by a normalized header", () => {
  expect(csvRecords("Employee ID,First Name\nE-1, Ada \n")).toEqual([
    { employeeid: "E-1", firstname: "Ada" },
  ]);
});

it("reads ISO and US dates", () => {
  expect(csvDate("2026-01-31")).toBe("2026-01-31");
  expect(csvDate("1/5/2026")).toBe("2026-01-05");
  expect(csvDate("Jan 5")).toBeUndefined();
});

it("reads an employee file into change rows", async () => {
  const { changeRowsFromCsv } = await import("./StakeholderChanges");
  const rows = changeRowsFromCsv(
    "Employee ID,First name,Last name,Email,Job title,Termination date\nE-1,Ada,Example,ada@example.test,Engineer,\nE-2,Ben,Sample,,,6/30/2026\n",
  );
  expect(rows).toEqual([
    {
      employeeId: "E-1",
      name: "Ada Example",
      email: "ada@example.test",
      terminationDate: undefined,
      proposed: {
        firstName: "Ada",
        lastName: "Example",
        contactEmail: "ada@example.test",
        jobTitle: "Engineer",
      },
    },
    {
      employeeId: "E-2",
      name: "Ben Sample",
      email: undefined,
      terminationDate: "2026-06-30",
      proposed: { firstName: "Ben", lastName: "Sample" },
    },
  ]);
});

it("summarizes an import by what happened", async () => {
  const { importSummary } = await import("./StakeholderChanges");
  expect(importSummary({ profile: 0, termination: 0, match: 2, unchanged: 0 })).toBe(
    "2 employees to match",
  );
  expect(importSummary({ profile: 1, termination: 0, match: 0, unchanged: 3, applied: 1 })).toBe(
    "1 profile change to review, 1 applied automatically, 3 unchanged",
  );
  expect(importSummary({ profile: 0, termination: 0, match: 0, unchanged: 0 })).toBe(
    "Nothing new in this file",
  );
});
