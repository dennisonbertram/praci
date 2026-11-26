import { expect, it } from "vitest";
import { parseCsv } from "./stakeholder-csv";
import { fixturePage } from "./stakeholder-fixtures";
import { autoMap, rowsToCreateInputs, rowsToUpdateInputs, templateCsv } from "./stakeholder-import";

const custom = [{ id: "cp-1", name: "Office", hrisField: null, createdAt: "", updatedAt: "" }];

it("writes a template with custom property columns", () => {
  expect(templateCsv(custom).split(",")).toContain("Office");
  expect(templateCsv(custom)).not.toMatch(/^ID,/);
  expect(templateCsv(custom, true)).toMatch(/^ID,/);
});

it("maps headers loosely, including custom properties", () => {
  expect(autoMap(["Full name", "E-mail", "relationship", "Office", "Shoe size"], custom)).toEqual([
    "name",
    "contactEmail",
    "relationship",
    "custom:cp-1",
    "",
  ]);
  expect(autoMap(["Email"], custom)).toEqual(["contactEmail"]);
});

it("builds create inputs with dated values and row errors", () => {
  const [header, ...rows] = parseCsv(
    "First name,Last name,Email,Relationship,Relationship start date,Office\nAda,Example,ADA@example.test,Ex-Employee,3/1/2024,North\n,,,,,\nBen,Sample,,Pilot,,\n",
  );
  const { inputs, errors } = rowsToCreateInputs(rows, autoMap(header!, custom));
  expect(inputs[0]).toMatchObject({
    type: "individual",
    name: "Ada Example",
    contactEmail: "ada@example.test",
    customValues: { "cp-1": "North" },
    properties: [{ kind: "relationship", effectiveDate: "2024-03-01", value: "ex_employee" }],
  });
  expect(errors).toEqual([{ row: 3, message: 'Unknown relationship "Pilot"' }]);
});

it("matches updates by ID or email and refuses unknown rows", () => {
  const existing = fixturePage().items;
  const [header, ...rows] = parseCsv(
    `ID,Email,Employee ID\nsh-2,,E-9\n,maya@example.test,E-7\n,nobody@example.test,E-8\n`,
  );
  const { inputs, errors } = rowsToUpdateInputs(rows, autoMap(header!, []), existing);
  expect(inputs).toEqual([
    { id: "sh-2", employeeId: "E-9" },
    { id: "sh-1", contactEmail: "maya@example.test", employeeId: "E-7" },
  ]);
  expect(errors).toEqual([{ row: 4, message: "No stakeholder with this ID or email" }]);
});
