import type { EquityOptionGrant } from "@rakazo/contracts";
import { expect, it } from "vitest";
import { csvCell, OPTION_GRANTS_CSV_HEADER, optionGrantsCsv } from "./option-grants-csv";

const grant: EquityOptionGrant = {
  id: "grant-1",
  label: "ES-40",
  stakeholderId: "stakeholder-1",
  stakeholderName: "Ada Lovelace",
  planId: "plan-1",
  planName: "2026 Stock Plan",
  status: "outstanding",
  optionType: "iso",
  quantity: "120000",
  exercisePrice: "1.20",
  grantDate: "2025-03-04",
  exercisedQuantity: "0",
  canceledQuantity: "0",
  outstandingQuantity: "120000",
  vestedQuantity: "25000",
  shareClassId: "sc-common",
  expirationDate: null,
  boardApprovedOn: null,
  postTerminationExerciseMonths: 3,
  earlyExercise: false,
  acceptanceStatus: "accepted",
  canceledOn: null,
  adminNotes: null,
  vestingSchedule: {
    id: "vesting-1",
    startDate: "2025-03-04",
    totalMonths: 48,
    cliffMonths: 12,
    frequencyMonths: 1,
    tranches: null,
    templateId: null,
    acceleratedShares: null,
    acceleratedOn: null,
    stoppedOn: null,
    description: '1/48 monthly, 1 year cliff, "standard"',
    createdAt: "2025-03-04T00:00:00.000Z",
    updatedAt: "2025-03-04T00:00:00.000Z",
  },
  createdAt: "2025-03-04T00:00:00.000Z",
  updatedAt: "2025-03-04T00:00:00.000Z",
};

it("writes a header row and one row per grant", () => {
  const csv = optionGrantsCsv([grant, { ...grant, id: "grant-2", label: "ES-41" }]);
  const [header, first, second] = csv.split("\r\n");
  expect(header).toBe(OPTION_GRANTS_CSV_HEADER.join(","));
  expect(first).toContain("ES-40");
  expect(first).toContain("Ada Lovelace");
  expect(second).toContain("ES-41");
});

it("quotes cells with a comma or a quote, doubling the quotes", () => {
  expect(csvCell("a,b")).toBe('"a,b"');
  expect(csvCell('say "hi"')).toBe('"say ""hi"""');
  expect(csvCell("plain")).toBe("plain");
  expect(optionGrantsCsv([grant])).toContain('"1/48 monthly, 1 year cliff, ""standard"""');
});

it("leaves an empty vesting schedule as an empty cell", () => {
  const csv = optionGrantsCsv([{ ...grant, vestingSchedule: null }]);
  expect(csv.split("\r\n")[1]).toBe("ES-40,Ada Lovelace,outstanding,120000,1.2,ISO,2025-03-04,");
});
