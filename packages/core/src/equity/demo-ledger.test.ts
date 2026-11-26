import {
  EQUITY_OUTSTANDING_CERTIFICATE_STATUSES,
  EquityAccessGrantSetInputSchema,
  EquityAccessGroupSetInputSchema,
  EquityCertificateCreateInputSchema,
  EquityConvertibleBlockCreateInputSchema,
  EquityConvertibleCreateInputSchema,
  EquityDraftSetCreateInputSchema,
  EquityExerciseCreateInputSchema,
  EquityFundingRoundCreateInputSchema,
  EquityOptionGrantCreateInputSchema,
  EquityPlanCreateInputSchema,
  EquitySavedViewCreateInputSchema,
  EquityShareClassCreateInputSchema,
  EquityShareClassVersionInputSchema,
  EquityStakeholderCreateInputSchema,
  EquityVestingTemplateCreateInputSchema,
} from "@rakazo/contracts";
import { describe, expect, it } from "vitest";
import { demoLedger } from "./demo-ledger.js";
import { parseFixed, SCALE, sharesTimesPrice } from "./fixed.js";
import { vestingRuleOf } from "./options-vesting.js";
import { pricedRoundConversion } from "./priced-round.js";
import { vestedShares } from "./vesting.js";

const ledger = demoLedger();

const ID = "clz000000000000000000000";

function omit<T extends Record<string, unknown>>(
  item: T,
  ...keys: string[]
): Record<string, unknown> {
  const copy: Record<string, unknown> = { ...item };
  for (const key of keys) delete copy[key];
  return copy;
}

/** A placeholder id standing in for a keyed record, before the database assigns real ids. */
function refId(key: string): string {
  return `${ID}${key}`;
}

describe("demoLedger", () => {
  it("returns the same data on every call", () => {
    expect(JSON.stringify(demoLedger())).toBe(JSON.stringify(demoLedger()));
    expect(demoLedger()).toEqual(demoLedger());
  });

  it("never expires a grant before its grant date", () => {
    for (const grant of ledger.optionGrants) {
      if (grant.expirationDate)
        expect(grant.expirationDate > grant.grantDate, grant.key).toBe(true);
    }
  });

  it("meets the minimum counts", () => {
    expect(ledger.stakeholders.length).toBeGreaterThanOrEqual(45);
    expect(ledger.stakeholders.filter((item) => item.type === "organization")).not.toHaveLength(0);
    expect(ledger.shareClasses).toHaveLength(5);
    expect(ledger.plans).toHaveLength(2);
    expect(ledger.vestingTemplates).toHaveLength(3);
    expect(ledger.fundingRounds).toHaveLength(4);
    expect(ledger.convertibleBlocks).toHaveLength(2);
    expect(ledger.certificates.length).toBeGreaterThanOrEqual(65);
    expect(ledger.convertibles.length).toBeGreaterThanOrEqual(16);
    expect(ledger.optionGrants.length).toBeGreaterThanOrEqual(45);
    expect(ledger.exercises.length).toBeGreaterThanOrEqual(3);
    expect(ledger.accessGroups).toHaveLength(5);
    expect(ledger.accessGrants.filter((item) => item.requestedAt != null)).toHaveLength(2);
    expect(ledger.accessGrants.filter((item) => item.requestedAt == null)).toHaveLength(3);
    expect(ledger.savedViews).toHaveLength(3);
    expect(ledger.draftSets).toHaveLength(1);
    expect(ledger.draftSets[0]?.items).toHaveLength(3);
  });

  it("keeps every key reference resolvable", () => {
    const stakeholderKeys = new Set(ledger.stakeholders.map((item) => item.key));
    const classKeys = new Set(ledger.shareClasses.map((item) => item.key));
    const planKeys = new Set(ledger.plans.map((item) => item.key));
    const roundKeys = new Set(ledger.fundingRounds.map((item) => item.key));
    const blockKeys = new Set(ledger.convertibleBlocks.map((item) => item.key));
    const certificateKeys = new Set(ledger.certificates.map((item) => item.key));
    const grantKeys = new Set(ledger.optionGrants.map((item) => item.key));
    const templateKeys = new Set(ledger.vestingTemplates.map((item) => item.key));

    for (const item of ledger.stakeholders) {
      if (item.parentKey != null)
        expect(stakeholderKeys.has(item.parentKey), item.parentKey).toBe(true);
    }
    for (const item of ledger.plans) expect(classKeys.has(item.shareClassKey)).toBe(true);
    for (const item of ledger.certificates) {
      expect(stakeholderKeys.has(item.stakeholderKey), item.key).toBe(true);
      expect(classKeys.has(item.shareClassKey), item.key).toBe(true);
      if (item.planKey != null) expect(planKeys.has(item.planKey), item.key).toBe(true);
      if (item.roundKey != null) expect(roundKeys.has(item.roundKey), item.key).toBe(true);
      if (item.parentKey != null) expect(certificateKeys.has(item.parentKey), item.key).toBe(true);
      if (item.disposition?.kind === "convert") {
        expect(classKeys.has(item.disposition.toShareClassKey), item.key).toBe(true);
      }
    }
    for (const item of ledger.convertibles) {
      expect(stakeholderKeys.has(item.stakeholderKey), item.key).toBe(true);
      if (item.blockKey != null) expect(blockKeys.has(item.blockKey), item.key).toBe(true);
      if (item.roundKey != null) expect(roundKeys.has(item.roundKey), item.key).toBe(true);
      if (item.convertsToShareClassKey != null) {
        expect(classKeys.has(item.convertsToShareClassKey), item.key).toBe(true);
      }
      if (item.convertedToKey != null)
        expect(certificateKeys.has(item.convertedToKey), item.key).toBe(true);
    }
    for (const certificate of ledger.certificates.filter((row) => row.parentKey != null))
      expect(certificateKeys.has(certificate.parentKey!), certificate.key).toBe(true);
    for (const round of ledger.pricedRounds) {
      expect(classKeys.has(round.toShareClassKey), round.key).toBe(true);
      expect(roundKeys.has(round.roundKey), round.key).toBe(true);
      for (const key of round.convertibleKeys)
        expect(
          ledger.convertibles.some((item) => item.key === key),
          round.key,
        ).toBe(true);
    }
    for (const item of ledger.optionGrants) {
      expect(stakeholderKeys.has(item.stakeholderKey), item.key).toBe(true);
      expect(planKeys.has(item.planKey), item.key).toBe(true);
      expect(templateKeys.has(item.vestingTemplateKey), item.key).toBe(true);
    }
    for (const item of ledger.exercises)
      expect(grantKeys.has(item.optionGrantKey), item.key).toBe(true);
    for (const item of ledger.accessGrants) {
      expect(stakeholderKeys.has(item.stakeholderKey), item.key).toBe(true);
    }
  });

  it("derives grant exercise counters from completed history and vested quantities", () => {
    const grantsByKey = new Map(ledger.optionGrants.map((grant) => [grant.key, grant]));
    const completedByGrant = new Map<string, bigint>();
    for (const exercise of ledger.exercises) {
      const grant = grantsByKey.get(exercise.optionGrantKey)!;
      expect(exercise.paymentCents).toBe(
        sharesTimesPrice(BigInt(exercise.quantity), parseFixed(grant.exercisePrice)).toString(),
      );
    }
    for (const exercise of ledger.exercises
      .filter((row) => row.status === "completed")
      .sort((a, b) => a.exerciseDate.localeCompare(b.exerciseDate))) {
      const grant = grantsByKey.get(exercise.optionGrantKey)!;
      expect(exercise.exerciseDate <= "2026-09-30").toBe(true);
      const completed = (completedByGrant.get(grant.key) ?? 0n) + BigInt(exercise.quantity);
      completedByGrant.set(grant.key, completed);
      if (!grant.earlyExercise && grant.vesting) {
        const schedule = {
          ...grant.vesting,
          totalMonths: grant.vesting.totalMonths ?? 0,
          cliffMonths: grant.vesting.cliffMonths ?? 0,
          frequencyMonths: grant.vesting.frequencyMonths ?? 1,
        };
        expect(
          vestedShares(vestingRuleOf(schedule), BigInt(grant.quantity), exercise.exerciseDate) >=
            completed,
          exercise.key,
        ).toBe(true);
      }
    }
    for (const grant of ledger.optionGrants) {
      const completed = completedByGrant.get(grant.key) ?? 0n;
      expect(completed <= BigInt(grant.quantity), grant.key).toBe(true);
      if (grant.status === "exercised") expect(completed).toBe(BigInt(grant.quantity));
      const history = ledger.exercises.find((row) => row.key === `exercise-history-${grant.key}`);
      expect(history?.quantity ?? "0", grant.key).toBe(grant.historyExerciseQuantity ?? "0");
      if (grant.historyExerciseQuantity && completed < BigInt(grant.quantity))
        expect(grant.status, grant.key).toBe("outstanding");
    }
  });

  it("matches Seed SAFE certificates to canonical priced-round output", () => {
    const round = ledger.pricedRounds[0]!;
    expect(
      ledger.fundingRounds.find((item) => item.key === round.roundKey)?.preMoneyValuationCents,
    ).toBe(round.preMoneyValuationCents);
    const baseShares =
      ledger.certificates
        .filter((row) => row.shareClassKey !== round.toShareClassKey && row.issueDate <= round.asOf)
        .reduce((sum, row) => sum + BigInt(row.quantity), 0n) +
      ledger.plans
        .filter((row) => row.boardApprovedOn != null && row.boardApprovedOn <= round.asOf)
        .reduce((sum, row) => sum + BigInt(row.reservedShares), 0n);
    expect(round.preMoneyValuationCents).toBe((baseShares * 100n).toString());

    const convertibles = round.convertibleKeys.map((key) => {
      const row = ledger.convertibles.find((item) => item.key === key)!;
      return {
        id: row.key,
        kind: "safe" as const,
        principalCents: BigInt(row.principalCents),
        valuationCapCents: row.valuationCapCents ? BigInt(row.valuationCapCents) : null,
        capType: row.valuationCapType ?? null,
        discountPercent: row.discountPercent ? parseFixed(row.discountPercent) : null,
      };
    });
    const result = pricedRoundConversion({
      preMoneyValuationCents: BigInt(round.preMoneyValuationCents),
      newMoneyCents: BigInt(round.newMoneyCents),
      preRoundFullyDilutedShares: baseShares,
      asOf: round.asOf,
      convertibles,
    });
    // The round's and the class's declared issue prices must be the price the kernel infers:
    // the seed's priced-round conversion rejects any other declared price.
    expect(
      ledger.fundingRounds.find((item) => item.key === round.roundKey)?.originalIssuePrice,
    ).toBe(result.pricePerShare);
    expect(
      ledger.shareClasses.find((item) => item.key === round.toShareClassKey)?.terms
        .originalIssuePrice,
    ).toBe(result.pricePerShare);
    const convertedCertificateKeys = new Set(
      round.convertibleKeys.map(
        (key) => ledger.convertibles.find((item) => item.key === key)!.convertedToKey!,
      ),
    );
    const directPurchase = ledger.certificates.find(
      (row) =>
        row.shareClassKey === round.toShareClassKey && !convertedCertificateKeys.has(row.key),
    )!;
    expect(result.newMoneyShares).toBe(BigInt(directPurchase.quantity));
    expect(directPurchase.cashPaidCents).toBe(round.newMoneyCents);
    expect(parseFixed(directPurchase.pricePerShare ?? "0")).toBe(parseFixed(result.pricePerShare));
    const certificates = round.convertibleKeys.map((key) => {
      const convertible = ledger.convertibles.find((item) => item.key === key)!;
      return ledger.certificates.find((item) => item.key === convertible.convertedToKey)!;
    });
    certificates.forEach((certificate, index) => {
      const convertible = ledger.convertibles.find(
        (item) => item.key === round.convertibleKeys[index],
      )!;
      expect(certificate.stakeholderKey).toBe(convertible.stakeholderKey);
      expect(certificate.shareClassKey).toBe(round.toShareClassKey);
      expect(certificate.roundKey).toBe(round.roundKey);
    });
    expect(
      result.convertibles.map((item) => [
        item.shares.toString(),
        item.conversionPrice,
        item.amountConvertedCents.toString(),
      ]),
    ).toEqual(
      certificates.map((item) => [item.quantity, item.pricePerShare, item.debtCanceledCents]),
    );
    expect(result.totalConvertedShares).toBe(
      certificates.reduce((sum, item) => sum + BigInt(item.quantity), 0n),
    );
    expect(result.convertibles.reduce((sum, item) => sum + item.amountConvertedCents, 0n)).toBe(
      convertibles.reduce((sum, item) => sum + item.principalCents, 0n),
    );
  });

  it("represents Series A conversion with its canonical child certificate", () => {
    const source = ledger.certificates.find((row) => row.disposition?.kind === "convert")!;
    const disposition = source.disposition!;
    if (disposition.kind !== "convert") throw new Error("Expected a conversion disposition");
    const scaled = BigInt(source.quantity) * parseFixed(disposition.ratio);
    expect(scaled % SCALE).toBe(0n);
    const child = ledger.certificates.find((row) => row.parentKey === source.key)!;
    expect(child.shareClassKey).toBe(disposition.toShareClassKey);
    expect(child.stakeholderKey).toBe(source.stakeholderKey);
    expect(child.quantity).toBe((scaled / SCALE).toString());
    expect(child.issueDate).toBe(disposition.effectiveDate);
    expect(child.pricePerShare).toBe(source.pricePerShare);
    expect(child.pricePaidPerShare).toBe(source.pricePaidPerShare);
  });

  it("keeps labels unique per class prefix", () => {
    const labels = ledger.certificates.map((item) => item.label);
    expect(new Set(labels).size).toBe(labels.length);
    const perPrefix = new Set<string>();
    for (const item of ledger.certificates) {
      const prefix =
        item.shareClassKey === "class-common"
          ? "CS"
          : item.shareClassKey === "class-seed"
            ? "PSS"
            : item.shareClassKey === "class-series-a"
              ? "PSA"
              : item.shareClassKey === "class-series-b"
                ? "PSB"
                : "PSB1";
      const label = item.label ?? "";
      expect(label.startsWith(`${prefix}-`), label).toBe(true);
      expect(perPrefix.has(label)).toBe(false);
      perPrefix.add(label);
    }
    const convertibleLabels = ledger.convertibles.map((item) => item.label);
    expect(new Set(convertibleLabels).size).toBe(convertibleLabels.length);
  });

  it("never issues more shares than a class authorizes", () => {
    const outstanding = new Set<string>(EQUITY_OUTSTANDING_CERTIFICATE_STATUSES);
    for (const shareClass of ledger.shareClasses) {
      const authorized = BigInt(shareClass.versions.at(-1)?.authorizedShares ?? "0");
      const issued = ledger.certificates
        .filter(
          (item) =>
            item.shareClassKey === shareClass.key && outstanding.has(item.status ?? "outstanding"),
        )
        .reduce((total, item) => total + BigInt(item.quantity), 0n);
      expect(issued <= authorized, `${shareClass.key}: ${issued} > ${authorized}`).toBe(true);
    }
  });

  it("never grants more options than a plan reserves", () => {
    for (const plan of ledger.plans) {
      const granted = ledger.optionGrants
        .filter((item) => item.planKey === plan.key)
        .reduce((total, item) => total + BigInt(item.quantity), 0n);
      expect(granted <= BigInt(plan.reservedShares), plan.key).toBe(true);
    }
  });

  it("parses every item with its create schema", () => {
    for (const item of ledger.stakeholders) {
      EquityStakeholderCreateInputSchema.parse(omit(item, "key", "parentKey"));
    }
    for (const item of ledger.shareClasses) {
      EquityShareClassCreateInputSchema.parse(omit(item, "key", "versions"));
      for (const version of item.versions) EquityShareClassVersionInputSchema.parse(version);
    }
    for (const item of ledger.plans) {
      EquityPlanCreateInputSchema.parse({
        ...omit(item, "key", "shareClassKey"),
        shareClassId: refId(item.shareClassKey),
      });
    }
    for (const item of ledger.vestingTemplates) {
      EquityVestingTemplateCreateInputSchema.parse(omit(item, "key"));
    }
    for (const item of ledger.fundingRounds) {
      EquityFundingRoundCreateInputSchema.parse(omit(item, "key"));
    }
    for (const item of ledger.convertibleBlocks) {
      EquityConvertibleBlockCreateInputSchema.parse(omit(item, "key"));
    }
    for (const item of ledger.certificates) {
      EquityCertificateCreateInputSchema.parse({
        ...omit(item, "key", "stakeholderKey", "shareClassKey", "planKey", "roundKey", "parentKey"),
        stakeholderId: refId(item.stakeholderKey),
        shareClassId: refId(item.shareClassKey),
        planId: item.planKey == null ? null : refId(item.planKey),
      });
    }
    for (const item of ledger.convertibles) {
      EquityConvertibleCreateInputSchema.parse({
        ...omit(
          item,
          "key",
          "stakeholderKey",
          "blockKey",
          "roundKey",
          "convertsToShareClassKey",
          "convertedToKey",
        ),
        stakeholderId: refId(item.stakeholderKey),
        blockId: item.blockKey == null ? null : refId(item.blockKey),
        roundId: item.roundKey == null ? null : refId(item.roundKey),
        convertsToShareClassId:
          item.convertsToShareClassKey == null ? null : refId(item.convertsToShareClassKey),
        convertedToId: item.convertedToKey == null ? null : refId(item.convertedToKey),
      });
    }
    for (const item of ledger.optionGrants) {
      const plan = ledger.plans.find((candidate) => candidate.key === item.planKey);
      EquityOptionGrantCreateInputSchema.parse({
        ...omit(
          item,
          "key",
          "stakeholderKey",
          "planKey",
          "vestingTemplateKey",
          "historyExerciseQuantity",
        ),
        stakeholderId: refId(item.stakeholderKey),
        planId: refId(item.planKey),
        shareClassId: refId(plan?.shareClassKey ?? "class-common"),
      });
    }
    for (const item of ledger.exercises) {
      EquityExerciseCreateInputSchema.parse({
        ...omit(item, "key", "optionGrantKey", "status"),
        optionGrantId: refId(item.optionGrantKey),
        requestKey: "00000000-0000-4000-8000-000000000001",
      });
    }
    for (const item of ledger.accessGroups) EquityAccessGroupSetInputSchema.parse(item);
    for (const item of ledger.accessGrants) {
      EquityAccessGrantSetInputSchema.parse({
        stakeholderId: refId(item.stakeholderKey),
        level: item.level,
      });
    }
    for (const item of ledger.savedViews) EquitySavedViewCreateInputSchema.parse(omit(item, "key"));
    for (const item of ledger.draftSets) EquityDraftSetCreateInputSchema.parse(omit(item, "key"));
  });

  it("keeps every date inside the ledger window", () => {
    const dates = new Set<string>();
    const collect = (value: unknown) => {
      if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value)) dates.add(value);
      else if (Array.isArray(value)) for (const item of value) collect(item);
      else if (value != null && typeof value === "object") {
        for (const [key, item] of Object.entries(value)) {
          if (key !== "dateOfBirth" && key !== "expirationDate") collect(item);
        }
      }
    };
    collect(ledger);
    for (const date of dates) {
      expect(date >= "2019-03-01" && date <= "2026-09-30", date).toBe(true);
    }
  });

  it("includes the states the views need", () => {
    const statuses = new Set(ledger.certificates.map((item) => item.status));
    expect(statuses.has("outstanding")).toBe(true);
    expect(statuses.has("transferred")).toBe(true);
    expect(statuses.has("repurchased")).toBe(true);
    expect(statuses.has("canceled")).toBe(true);
    expect(statuses.has("converted")).toBe(true);
    expect(
      ledger.certificates.some((item) => item.acceptanceStatus === "awaiting_holder_signature"),
    ).toBe(true);
    expect(ledger.certificates.some((item) => item.paperStatus === "paper")).toBe(true);
    const grantStatuses = new Set(ledger.optionGrants.map((item) => item.status));
    expect(grantStatuses.has("outstanding")).toBe(true);
    expect(grantStatuses.has("exercised")).toBe(true);
    expect(grantStatuses.has("forfeited")).toBe(true);
    expect(grantStatuses.has("canceled")).toBe(true);
    expect(grantStatuses.has("expired")).toBe(true);
    expect(ledger.optionGrants.some((item) => item.historyExerciseQuantity != null)).toBe(true);
    expect(
      ledger.stakeholders.some((item) =>
        item.properties?.some((prop) => prop.value === "ex_employee"),
      ),
    ).toBe(true);
    expect(ledger.convertibles.filter((item) => item.kind === "safe")).not.toHaveLength(0);
    expect(ledger.convertibles.filter((item) => item.kind === "note")).not.toHaveLength(0);
    const funds = ledger.stakeholders.filter((item) => item.parentKey != null);
    expect(funds).toHaveLength(3);
  });
});
