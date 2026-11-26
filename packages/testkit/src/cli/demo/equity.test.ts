import { demoLedger } from "@rakazo/core/equity";
import { beforeEach, expect, it, vi } from "vitest";

const STORES = vi.hoisted(() => [
  "cancelEquityCertificate",
  "cancelEquityOptionGrant",
  "convertEquityCertificate",
  "convertEquityPricedRound",
  "createEquityCertificate",
  "createEquityConvertible",
  "createEquityConvertibleBlock",
  "createEquityDraftSet",
  "createEquityExercise",
  "createEquityFundingRound",
  "createEquityOptionGrant",
  "createEquityPlan",
  "createEquitySavedView",
  "createEquityShareClass",
  "createEquityStakeholder",
  "createEquityVestingTemplate",
  "expireEquityOptionGrants",
  "repurchaseEquityCertificate",
  "setEquityAccessGrant",
  "setEquityAccessGroup",
  "terminateEquityStakeholder",
  "transferEquityCertificate",
  "updateEquityConvertible",
  "updateEquityExercise",
  "updateEquityShareClass",
  "runEquityHealthChecks",
]);

const REFERENCES = new Set([
  "stakeholderId",
  "shareClassId",
  "planId",
  "roundId",
  "parentId",
  "blockId",
  "convertsToShareClassId",
  "toShareClassId",
  "convertedToId",
  "optionGrantId",
]);

const calls: { name: string; input: Record<string, unknown> }[] = [];
let next = 0;
let activeLedger: ReturnType<typeof demoLedger> | null = null;
const stakeholderIds = new Map<string, string>();
const fundingRoundIds = new Map<string, string>();
let stakeholderCreationIndex = 0;
vi.mock("@rakazo/db", () => {
  const record =
    (name: string) => async (_prisma: unknown, _actor: unknown, input: Record<string, unknown>) => {
      calls.push({ name, input: input ?? {} });
      next += 1;
      if (name === "createEquityStakeholder") {
        const stakeholders = [
          ...activeLedger!.stakeholders.filter((row) => !row.parentKey),
          ...activeLedger!.stakeholders.filter((row) => row.parentKey),
        ];
        stakeholderIds.set(stakeholders[stakeholderCreationIndex++]!.key, `id-${next}`);
        return { id: `id-${next}` };
      }
      if (name === "createEquityFundingRound") {
        const key = activeLedger!.fundingRounds.find((row) => row.name === input.name)!.key;
        fundingRoundIds.set(key, `id-${next}`);
        return { id: `id-${next}` };
      }
      if (name === "transferEquityCertificate")
        return {
          resulting: [{ id: `id-${next}`, stakeholderId: input.toStakeholderId }],
        };
      if (name === "convertEquityCertificate") {
        const source = activeLedger!.certificates.find(
          (row) => row.disposition?.kind === "convert",
        )!;
        const child = activeLedger!.certificates.find((row) => row.parentKey === source.key)!;
        return {
          resulting: [
            {
              id: `id-${next}`,
              label: child.label,
              stakeholderId: stakeholderIds.get(child.stakeholderKey),
              shareClassId: input.toShareClassId,
              parentId: input.certificateId,
              quantity: child.quantity,
              issueDate: child.issueDate,
              roundId: fundingRoundIds.get(child.roundKey!),
              pricePerShare: child.pricePerShare,
              pricePaidPerShare: child.pricePaidPerShare,
            },
          ],
        };
      }
      if (name === "convertEquityPricedRound") {
        const ledger = activeLedger!;
        const round = ledger.pricedRounds[0]!;
        const expected = round.convertibleKeys
          .map((key) => {
            const convertible = ledger.convertibles.find((row) => row.key === key)!;
            const certificate = ledger.certificates.find(
              (row) => row.key === convertible.convertedToKey,
            )!;
            return { convertible, certificate };
          })
          .reverse();
        const totalShares = expected.reduce(
          (sum, row) => sum + BigInt(row.certificate.quantity),
          0n,
        );
        const certificates = expected.map(({ certificate }) => {
          next += 1;
          return {
            id: `id-${next}`,
            stakeholderId: stakeholderIds.get(certificate.stakeholderKey),
            shareClassId: input.toShareClassId,
            roundId: input.roundId,
            quantity: certificate.quantity,
            debtCanceledCents: certificate.debtCanceledCents,
            pricePerShare: certificate.pricePerShare,
          };
        });
        const directPurchase = ledger.certificates.find(
          (row) =>
            row.shareClassKey === round.toShareClassKey &&
            !expected.some(({ certificate }) => certificate.key === row.key),
        )!;
        return {
          preview: {
            preRoundFullyDilutedShares: "15178500",
            pricePerShare: directPurchase.pricePerShare,
            newMoneyShares: directPurchase.quantity,
            postRoundFullyDilutedShares: (
              15178500n +
              BigInt(directPurchase.quantity) +
              totalShares
            ).toString(),
            totalConvertedShares: totalShares.toString(),
            convertibles: expected.map(({ convertible, certificate }) => ({
              id: (input.convertibleIds as string[])[
                round.convertibleKeys.indexOf(convertible.key)
              ],
              label: convertible.label,
              stakeholderName: ledger.stakeholders.find(
                (row) => row.key === convertible.stakeholderKey,
              )!.name,
              method: convertible.discountPercent ? "discount" : "cap",
              conversionPrice: certificate.pricePerShare,
              amountConvertedCents: certificate.debtCanceledCents,
              shares: certificate.quantity,
            })),
          },
          certificates,
        };
      }
      return { id: `id-${next}` };
    };
  return Object.fromEntries(STORES.map((name) => [name, record(name)]));
});

const { seedDemoEquityLedger } = await import("./equity.js");

beforeEach(() => {
  calls.length = 0;
  next = 0;
  activeLedger = null;
  stakeholderIds.clear();
  fundingRoundIds.clear();
  stakeholderCreationIndex = 0;
});

const named = (name: string) => calls.filter((call) => call.name === name);

it("loads every demo row through the stores, with ids in place of keys", async () => {
  const ledger = demoLedger();
  activeLedger = ledger;
  await seedDemoEquityLedger({} as never, { spaceId: "space", userId: "user" }, ledger);

  expect(named("createEquityStakeholder")).toHaveLength(ledger.stakeholders.length);
  expect(named("createEquityShareClass")).toHaveLength(ledger.shareClasses.length);
  const convertedCertificateKeys = new Set(
    ledger.convertibles
      .map((row) => row.convertedToKey)
      .filter((key): key is string => key != null),
  );
  expect(named("createEquityCertificate")).toHaveLength(
    ledger.certificates.filter((row) => !row.parentKey && !convertedCertificateKeys.has(row.key))
      .length,
  );
  expect(named("createEquityConvertible")).toHaveLength(ledger.convertibles.length);
  expect(
    named("createEquityConvertible").every(
      (call) =>
        call.input.status === "outstanding" &&
        call.input.convertedToId == null &&
        call.input.closedOn == null &&
        call.input.canceledOn == null,
    ),
  ).toBe(true);
  expect(named("convertEquityPricedRound")).toHaveLength(ledger.pricedRounds.length);
  expect(named("updateEquityConvertible")).toHaveLength(
    ledger.convertibles.filter((row) => row.status === "repaid").length,
  );
  expect(named("updateEquityConvertible").map((call) => call.input.closedOn)).toEqual(
    ledger.convertibles.filter((row) => row.status === "repaid").map((row) => row.closedOn),
  );
  expect(named("createEquityOptionGrant")).toHaveLength(ledger.optionGrants.length);
  expect(
    named("createEquityOptionGrant").every(
      (call) => call.input.status == null && call.input.canceledOn == null,
    ),
  ).toBe(true);
  expect(
    named("createEquityCertificate").every(
      (call) =>
        (call.input.status === "outstanding" || call.input.status === "waiting_for_acceptance") &&
        call.input.parentId == null &&
        call.input.canceledOn == null,
    ),
  ).toBe(true);
  const transferChildren = ledger.certificates.filter((row) => {
    const parent = ledger.certificates.find((candidate) => candidate.key === row.parentKey);
    return parent?.disposition?.kind === "transfer";
  });
  expect(named("transferEquityCertificate")).toHaveLength(transferChildren.length);
  expect(named("convertEquityCertificate")).toHaveLength(
    ledger.certificates.filter((row) => row.disposition?.kind === "convert").length,
  );
  const transferredSource = ledger.certificates.find((row) => row.status === "transferred")!;
  const transferCall = named("transferEquityCertificate")[0]!;
  const sourceCreate = named("createEquityCertificate").find(
    (call) => call.input.label === transferredSource.label,
  )!;
  expect(transferCall.input.toStakeholderId).not.toBe(sourceCreate.input.stakeholderId);
  expect(transferCall.input.reason).toBe("transfer_to_affiliated_entity");
  expect(transferCall.input.effectiveDate).toBe(transferredSource.disposition?.effectiveDate);
  expect(named("cancelEquityCertificate")).toHaveLength(
    ledger.certificates.filter((row) => row.disposition?.kind === "cancel").length,
  );
  expect(named("repurchaseEquityCertificate")).toHaveLength(
    ledger.certificates.filter((row) => row.disposition?.kind === "repurchase").length,
  );
  expect(named("cancelEquityOptionGrant")).toHaveLength(
    ledger.optionGrants.filter((row) => row.status === "canceled").length,
  );
  expect(named("terminateEquityStakeholder")).toHaveLength(
    ledger.optionGrants.filter((row) => row.status === "forfeited").length,
  );
  expect(named("expireEquityOptionGrants")).toHaveLength(1);
  expect(named("createEquityPlan")).toHaveLength(ledger.plans.length);
  expect(named("setEquityAccessGroup")).toHaveLength(ledger.accessGroups.length);
  // Findings come from the real checks, run once after every row is in.
  expect(named("runEquityHealthChecks")).toHaveLength(1);
  expect(calls.at(-1)?.name).toBe("runEquityHealthChecks");

  for (const call of calls) {
    for (const [field, value] of Object.entries(call.input)) {
      expect(field.endsWith("Key") && field !== "requestKey", `${call.name}.${field}`).toBe(false);
      if (REFERENCES.has(field) && value != null) expect(String(value)).toMatch(/^id-\d+$/);
    }
  }
  const [draft] = named("createEquityDraftSet");
  for (const item of draft!.input.items as Record<string, unknown>[]) {
    expect(Object.keys(item).some((field) => field.endsWith("Key"))).toBe(false);
    expect(item.stakeholderId).toMatch(/^id-\d+$/);
  }
});

it("creates a fund's firm before the fund and skips exercises of closed grants", async () => {
  const ledger = demoLedger();
  activeLedger = ledger;
  await seedDemoEquityLedger({} as never, { spaceId: "space", userId: "user" }, ledger);

  const stakeholders = named("createEquityStakeholder");
  const firstChild = stakeholders.findIndex((call) => call.input.parentId != null);
  expect(firstChild).toBeGreaterThan(0);
  expect(stakeholders.slice(0, firstChild).every((call) => call.input.parentId == null)).toBe(true);
  const open = new Set(
    ledger.optionGrants
      .filter((grant) => (grant.status ?? "outstanding") === "outstanding")
      .map((grant) => grant.key),
  );
  const expected = ledger.exercises.filter((row) => open.has(row.optionGrantKey)).length;
  const completedHistory = ledger.exercises.filter((row) => row.status === "completed").length;
  expect(named("createEquityExercise")).toHaveLength(
    expected +
      ledger.exercises.filter((row) => row.status === "completed" && !open.has(row.optionGrantKey))
        .length,
  );
  expect(
    named("createEquityExercise").every(
      (call) =>
        typeof call.input.requestKey === "string" &&
        /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
          String(call.input.requestKey),
        ),
    ),
  ).toBe(true);
  expect(named("updateEquityExercise")).toHaveLength(completedHistory);
});
