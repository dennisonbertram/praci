import { expect, it } from "vitest";
import {
  EquityExerciseCreateInputSchema,
  EquityExerciseSchema,
  EquityOptionGrantCreateInputSchema,
  EquityOptionGrantSchema,
  EquityOptionGrantUpdateInputSchema,
  EquityVestingScheduleInputSchema,
} from "./options.js";
import { EquityExerciseOptionsInputSchema } from "./options-exercise.js";

it("requires a vesting total unless a template is supplied", () => {
  const schedule = { startDate: "2024-01-01" };
  expect(
    EquityVestingScheduleInputSchema.safeParse({
      ...schedule,
      templateId: "template-1",
    }).success,
  ).toBe(true);
  expect(EquityVestingScheduleInputSchema.safeParse(schedule).success).toBe(false);
});

it("requires positive grant and exercise shares and a caller request key", () => {
  expect(
    EquityOptionGrantCreateInputSchema.safeParse({
      stakeholderId: "holder-1",
      planId: "plan-1",
      optionType: "iso",
      quantity: "0",
      exercisePrice: "1",
      grantDate: "2024-01-01",
    }).success,
  ).toBe(false);
  expect(
    EquityExerciseOptionsInputSchema.safeParse({
      optionGrantId: "grant-1",
      quantity: "0",
      exerciseDate: "2024-01-01",
      requestKey: "00000000-0000-4000-8000-000000000001",
    }).success,
  ).toBe(false);
  expect(
    EquityExerciseCreateInputSchema.safeParse({
      optionGrantId: "grant-1",
      quantity: "0",
      exerciseDate: "2024-01-01",
      requestKey: "00000000-0000-4000-8000-000000000001",
    }).success,
  ).toBe(false);
  expect(
    EquityOptionGrantUpdateInputSchema.safeParse({ id: "grant-1", quantity: "0" }).success,
  ).toBe(false);
  expect(
    EquityExerciseOptionsInputSchema.safeParse({
      optionGrantId: "grant-1",
      quantity: "1",
      exerciseDate: "2024-01-01",
    }).success,
  ).toBe(false);
});

it("keeps legacy zero-quantity grant and exercise DTOs readable", () => {
  const timestamp = "2024-01-01T00:00:00.000Z";
  expect(
    EquityOptionGrantSchema.safeParse({
      id: "grant-1",
      createdAt: timestamp,
      updatedAt: timestamp,
      label: "ES-1",
      stakeholderId: "holder-1",
      planId: "plan-1",
      shareClassId: "class-1",
      status: "outstanding",
      optionType: "iso",
      quantity: "0",
      exercisePrice: "0.1",
      grantDate: "2024-01-01",
      expirationDate: null,
      boardApprovedOn: null,
      postTerminationExerciseMonths: null,
      earlyExercise: false,
      acceptanceStatus: "accepted",
      canceledOn: null,
      adminNotes: null,
      stakeholderName: "Ada",
      planName: "Plan",
      exercisedQuantity: "0",
      canceledQuantity: "0",
      outstandingQuantity: "0",
      vestedQuantity: "0",
      vestingSchedule: null,
    }).success,
  ).toBe(true);
  expect(
    EquityExerciseSchema.safeParse({
      id: "exercise-1",
      createdAt: timestamp,
      updatedAt: timestamp,
      optionGrantId: "grant-1",
      optionGrantLabel: "ES-1",
      quantity: "0",
      exerciseDate: "2024-01-01",
      status: "pending",
      paymentCents: "0",
      requestKey: null,
      certificateId: null,
    }).success,
  ).toBe(true);
});

it("rejects malformed positive share values without throwing", () => {
  const grant = {
    stakeholderId: "holder-1",
    planId: "plan-1",
    optionType: "iso",
    exercisePrice: "1",
    grantDate: "2024-01-01",
  };
  const pending = {
    optionGrantId: "grant-1",
    exerciseDate: "2024-01-01",
    requestKey: "00000000-0000-4000-8000-000000000001",
  };
  for (const quantity of ["1.5", "abc", "1e3"]) {
    expect(() =>
      EquityOptionGrantCreateInputSchema.safeParse({ ...grant, quantity }),
    ).not.toThrow();
    expect(EquityOptionGrantCreateInputSchema.safeParse({ ...grant, quantity }).success).toBe(
      false,
    );
    expect(() => EquityExerciseCreateInputSchema.safeParse({ ...pending, quantity })).not.toThrow();
    expect(EquityExerciseCreateInputSchema.safeParse({ ...pending, quantity }).success).toBe(false);
    expect(() =>
      EquityExerciseOptionsInputSchema.safeParse({ ...pending, quantity }),
    ).not.toThrow();
    expect(EquityExerciseOptionsInputSchema.safeParse({ ...pending, quantity }).success).toBe(
      false,
    );
  }
});

it("accepts only vesting tranches that sum to 100 with strictly increasing months", () => {
  const parse = (tranches: { monthOffset: number; percent: string }[]) =>
    EquityVestingScheduleInputSchema.safeParse({
      startDate: "2024-01-01",
      totalMonths: 12,
      tranches,
    }).success;
  expect(
    parse([
      { monthOffset: 6, percent: "50" },
      { monthOffset: 12, percent: "50" },
    ]),
  ).toBe(true);
  expect(parse([{ monthOffset: 12, percent: "100" }])).toBe(true);
  expect(
    parse([
      { monthOffset: 6, percent: "25" },
      { monthOffset: 12, percent: "25" },
    ]),
  ).toBe(false);
  expect(
    parse([
      { monthOffset: 6, percent: "150" },
      { monthOffset: 12, percent: "10" },
    ]),
  ).toBe(false);
  expect(
    parse([
      { monthOffset: 6, percent: "50" },
      { monthOffset: 6, percent: "50" },
    ]),
  ).toBe(false);
  expect(
    parse([
      { monthOffset: 12, percent: "50" },
      { monthOffset: 6, percent: "50" },
    ]),
  ).toBe(false);
  expect(
    parse([
      { monthOffset: 6, percent: "-10" },
      { monthOffset: 12, percent: "110" },
    ]),
  ).toBe(false);
});
