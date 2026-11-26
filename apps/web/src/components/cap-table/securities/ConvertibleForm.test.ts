import { expect, it, vi } from "vitest";

vi.mock("@lingui/core/macro", () => ({ t: (parts: TemplateStringsArray) => parts.join("") }));
vi.mock("../../../lib/rpc", () => ({ rpc: {} }));

import type { ConvertibleFormValues } from "./ConvertibleForm";
import { convertibleInput } from "./ConvertibleForm";

const form = (overrides: Partial<ConvertibleFormValues> = {}): ConvertibleFormValues => ({
  stakeholderId: "sh-1",
  kind: "safe",
  blockId: "cb-1",
  newBlockName: "",
  amount: "100000",
  issueDate: "2025-06-01",
  valuationCap: "",
  valuationCapType: "post_money",
  discount: "",
  mfn: false,
  proRata: false,
  interestRate: "",
  interestStartDate: "",
  interestType: "simple",
  maturityDate: "",
  reason: "clerical_error",
  ...overrides,
});

it("reads the amount as whole cents without floats", () => {
  const input = convertibleInput(form({ amount: "$1,500,000.50" }));
  expect(typeof input).toBe("object");
  expect((input as { principalCents: string }).principalCents).toBe("150000050");
});

it("includes note fields only for notes", () => {
  const safe = convertibleInput(form());
  expect(safe).not.toHaveProperty("interestRate");
  expect(safe).not.toHaveProperty("interestType");
  expect(safe).not.toHaveProperty("maturityDate");
  const note = convertibleInput(
    form({
      kind: "note",
      interestRate: "8",
      interestStartDate: "2025-06-01",
      interestType: "compound",
      maturityDate: "2026-06-01",
    }),
  ) as unknown as Record<string, unknown>;
  expect(note.interestRate).toBe("8");
  expect(note.interestStartDate).toBe("2025-06-01");
  expect(note.interestType).toBe("compound");
  expect(note.maturityDate).toBe("2026-06-01");
});

it("names a missing amount", () => {
  expect(convertibleInput(form({ amount: "" }))).toMatch(/amount/i);
});

it("saves a SAFE with no terms", () => {
  const input = convertibleInput(form({ blockId: "" }));
  expect(typeof input).not.toBe("string");
  expect(input).not.toHaveProperty("blockId");
});
