import { randomUUID } from "node:crypto";
import type { DemoLedger } from "@rakazo/core/equity";
import { parseFixed } from "@rakazo/core/equity";
import type { EquityDb, EquityScope } from "@rakazo/db";
import {
  cancelEquityCertificate,
  cancelEquityOptionGrant,
  convertEquityCertificate,
  convertEquityPricedRound,
  createEquityCertificate,
  createEquityConvertible,
  createEquityConvertibleBlock,
  createEquityDraftSet,
  createEquityExercise,
  createEquityFundingRound,
  createEquityOptionGrant,
  createEquityPlan,
  createEquitySavedView,
  createEquityShareClass,
  createEquityStakeholder,
  createEquityVestingTemplate,
  expireEquityOptionGrants,
  repurchaseEquityCertificate,
  runEquityHealthChecks,
  setEquityAccessGrant,
  setEquityAccessGroup,
  terminateEquityStakeholder,
  transferEquityCertificate,
  updateEquityConvertible,
  updateEquityExercise,
  updateEquityShareClass,
} from "@rakazo/db";

/**
 * Loads the invented demo cap table into one user's ledger through the equity stores, so the
 * seed goes through the same validation and transactions as the app. Keys become ids as rows land.
 */
export async function seedDemoEquityLedger(
  prisma: EquityDb,
  actor: EquityScope,
  ledger: DemoLedger,
) {
  const ids = new Map<string, string>();
  const id = (key: string | null | undefined) => {
    if (key == null) return null;
    const found = ids.get(key);
    if (!found) throw new Error(`Demo ledger key ${key} has no row yet`);
    return found;
  };

  const parents = ledger.stakeholders.filter((row) => !row.parentKey);
  const children = ledger.stakeholders.filter((row) => row.parentKey);
  for (const { key, parentKey, ...row } of [...parents, ...children]) {
    const created = await createEquityStakeholder(prisma, actor, {
      ...row,
      parentId: id(parentKey),
    });
    ids.set(key, created.id);
  }
  for (const { key, versions, ...row } of ledger.shareClasses) {
    const created = await createEquityShareClass(prisma, actor, row);
    ids.set(key, created.id);
    for (const terms of versions.slice(1)) {
      await updateEquityShareClass(prisma, actor, { id: created.id, terms });
    }
  }
  for (const { key, shareClassKey, ...row } of ledger.plans) {
    const created = await createEquityPlan(prisma, actor, {
      ...row,
      shareClassId: id(shareClassKey)!,
    });
    ids.set(key, created.id);
  }
  for (const { key, ...row } of ledger.vestingTemplates) {
    ids.set(key, (await createEquityVestingTemplate(prisma, actor, row)).id);
  }
  for (const { key, ...row } of ledger.fundingRounds) {
    ids.set(key, (await createEquityFundingRound(prisma, actor, row)).id);
  }
  for (const { key, ...row } of ledger.convertibleBlocks) {
    ids.set(key, (await createEquityConvertibleBlock(prisma, actor, row)).id);
  }
  const roots = ledger.certificates.filter((row) => !row.parentKey);
  for (const {
    key,
    stakeholderKey,
    shareClassKey,
    planKey,
    roundKey,
    parentKey: _parentKey,
    status,
    canceledOn: _canceledOn,
    disposition: _disposition,
    ...row
  } of roots.filter((row) => row.shareClassKey !== "class-seed")) {
    const created = await createEquityCertificate(prisma, actor, {
      ...row,
      stakeholderId: id(stakeholderKey)!,
      shareClassId: id(shareClassKey)!,
      planId: id(planKey),
      roundId: id(roundKey),
      status: status === "waiting_for_acceptance" ? status : "outstanding",
    });
    ids.set(key, created.id);
  }
  const convertibleRows = new Map(ledger.convertibles.map((row) => [row.key, row]));
  const convertedCertificateKeys = new Set(
    ledger.convertibles
      .map((row) => row.convertedToKey)
      .filter((key): key is string => key != null),
  );
  for (const {
    key,
    stakeholderKey,
    blockKey,
    roundKey,
    convertsToShareClassKey,
    status: _status,
    closedOn: _closedOn,
    canceledOn: _canceledOn,
    cancellationReason: _cancellationReason,
    convertedToKey: _convertedToKey,
    ...row
  } of ledger.convertibles) {
    const created = await createEquityConvertible(prisma, actor, {
      ...row,
      status: "outstanding",
      stakeholderId: id(stakeholderKey)!,
      blockId: id(blockKey),
      roundId: id(roundKey),
      convertsToShareClassId: id(convertsToShareClassKey),
    });
    ids.set(key, created.id);
  }
  for (const pricedRound of ledger.pricedRounds) {
    const expectedCertificates = pricedRound.convertibleKeys.map((key) => {
      const convertible = convertibleRows.get(key);
      const certificate = ledger.certificates.find(
        (row) => row.key === convertible?.convertedToKey,
      );
      if (!convertible || !certificate)
        throw new Error(`Priced round ${pricedRound.key} has incomplete SAFE fixture rows`);
      return { convertible, certificate };
    });
    const expectedPreRoundShares =
      ledger.certificates
        .filter(
          (row) =>
            row.shareClassKey !== pricedRound.toShareClassKey && row.issueDate <= pricedRound.asOf,
        )
        .reduce((sum, row) => sum + BigInt(row.quantity), 0n) +
      ledger.plans
        .filter(
          (row) => row.boardApprovedOn != null && row.boardApprovedOn <= pricedRound.asOf,
        )
        .reduce((sum, row) => sum + BigInt(row.reservedShares), 0n);
    const result = await convertEquityPricedRound(prisma, actor, {
      convertibleIds: pricedRound.convertibleKeys.map((key) => id(key)!),
      toShareClassId: id(pricedRound.toShareClassKey)!,
      roundId: id(pricedRound.roundKey)!,
      preMoneyValuationCents: pricedRound.preMoneyValuationCents,
      newMoneyCents: pricedRound.newMoneyCents,
      asOf: pricedRound.asOf,
    });
    if (
      BigInt(result.preview.preRoundFullyDilutedShares) !== expectedPreRoundShares ||
      result.certificates.length !== expectedCertificates.length ||
      result.preview.convertibles.length !== expectedCertificates.length
    )
      throw new Error(`Priced round ${pricedRound.key} did not match the demo cap-table fixture`);
    const expectedByConvertibleId = new Map(
      expectedCertificates.map((row) => [id(row.convertible.key)!, row]),
    );
    const directPurchase = ledger.certificates.find(
      (row) =>
        row.shareClassKey === pricedRound.toShareClassKey && !convertedCertificateKeys.has(row.key),
    );
    if (
      !directPurchase ||
      directPurchase.quantity !== result.preview.newMoneyShares ||
      directPurchase.cashPaidCents !== pricedRound.newMoneyCents
    )
      throw new Error(`Priced round ${pricedRound.key} did not conserve its direct investment`);
    let convertedShares = 0n;
    let convertedCents = 0n;
    for (const [index, preview] of result.preview.convertibles.entries()) {
      const expected = expectedByConvertibleId.get(preview.id);
      const issued = result.certificates[index]!;
      if (!expected) throw new Error(`Priced round returned an unknown convertible ${preview.id}`);
      const { convertible, certificate } = expected;
      const matches = {
        label: preview.label === convertible.label,
        stakeholder:
          preview.stakeholderName ===
          ledger.stakeholders.find((row) => row.key === convertible.stakeholderKey)?.name,
        shares: preview.shares === certificate.quantity && issued.quantity === certificate.quantity,
        previewPrice: parseFixed(preview.conversionPrice) === parseFixed(certificate.pricePerShare),
        issuedPrice:
          issued.pricePerShare != null &&
          parseFixed(issued.pricePerShare) === parseFixed(certificate.pricePerShare),
        amount:
          preview.amountConvertedCents === certificate.debtCanceledCents &&
          issued.debtCanceledCents === certificate.debtCanceledCents,
        issuedToExpectedHolder: issued.stakeholderId === id(convertible.stakeholderKey),
        issuedToExpectedClass: issued.shareClassId === id(pricedRound.toShareClassKey),
        issuedToExpectedRound: issued.roundId === id(pricedRound.roundKey),
      };
      const mismatches = Object.keys(matches).filter(
        (key) => !matches[key as keyof typeof matches],
      );
      if (mismatches.length)
        throw new Error(
          `Priced round output does not match ${certificate.key}: ${mismatches.join(", ")}`,
        );
      convertedShares += BigInt(preview.shares);
      convertedCents += BigInt(preview.amountConvertedCents);
      ids.set(convertible.convertedToKey!, issued.id);
    }
    if (
      convertedShares !== BigInt(result.preview.totalConvertedShares) ||
      convertedCents !==
        expectedCertificates.reduce(
          (sum, { convertible }) => sum + BigInt(convertible.principalCents),
          0n,
        )
    )
      throw new Error(`Priced round ${pricedRound.key} failed share or principal conservation`);
  }
  for (const note of ledger.convertibles.filter((row) => row.status === "repaid")) {
    if (note.closedOn == null) throw new Error(`Repaid demo note ${note.key} has no closure date`);
    await updateEquityConvertible(prisma, actor, {
      id: id(note.key)!,
      status: "repaid",
      closedOn: note.closedOn,
      reason: "amendment",
      note: "Synthetic demo note repaid at maturity.",
    });
  }
  for (const source of roots) {
    if (source.shareClassKey === "class-seed" && convertedCertificateKeys.has(source.key)) continue;
    if (source.shareClassKey === "class-seed") {
      const { key, stakeholderKey, shareClassKey, planKey, roundKey, status, ...row } = source;
      const created = await createEquityCertificate(prisma, actor, {
        ...row,
        stakeholderId: id(stakeholderKey)!,
        shareClassId: id(shareClassKey)!,
        planId: id(planKey),
        roundId: id(roundKey),
        status: status === "waiting_for_acceptance" ? status : "outstanding",
      });
      ids.set(key, created.id);
    }
    if (source.status === "transferred") {
      const child = ledger.certificates.find((row) => row.parentKey === source.key);
      if (!child) throw new Error(`Transferred demo certificate ${source.key} has no child`);
      const disposition = source.disposition;
      if (disposition?.kind !== "transfer")
        throw new Error(`Transferred demo certificate ${source.key} has no transfer terms`);
      if (child.stakeholderKey !== disposition.toStakeholderKey)
        throw new Error(`Transferred demo certificate ${source.key} has mismatched recipient`);
      const result = await transferEquityCertificate(prisma, actor, {
        certificateId: id(source.key)!,
        toStakeholderId: id(disposition.toStakeholderKey)!,
        quantity: child.quantity,
        effectiveDate: disposition.effectiveDate,
        reason: disposition.reason,
        note: child.adminNotes,
      });
      const transferred = result.resulting.find(
        (row) => row.stakeholderId === id(child.stakeholderKey),
      );
      if (!transferred) throw new Error(`Transfer did not create demo child ${child.key}`);
      ids.set(child.key, transferred.id);
      continue;
    }
    const disposition = source.disposition;
    if (!disposition) {
      if (["canceled", "converted", "repurchased"].includes(source.status ?? ""))
        throw new Error(`Demo certificate ${source.key} is missing disposition terms`);
      continue;
    }
    if (disposition.kind === "cancel") {
      await cancelEquityCertificate(prisma, actor, {
        certificateId: id(source.key)!,
        quantity: source.quantity,
        effectiveDate: disposition.effectiveDate,
        reason: disposition.reason,
      });
    } else if (disposition.kind === "repurchase") {
      await repurchaseEquityCertificate(prisma, actor, {
        certificateId: id(source.key)!,
        quantity: source.quantity,
        effectiveDate: disposition.effectiveDate,
        reason: disposition.reason,
      });
    } else {
      const converted = await convertEquityCertificate(prisma, actor, {
        certificateId: id(source.key)!,
        toShareClassId: id(disposition.toShareClassKey)!,
        effectiveDate: disposition.effectiveDate,
        ratio: disposition.ratio,
      });
      const child = ledger.certificates.find((row) => row.parentKey === source.key);
      const issued = converted.resulting[0];
      if (!child || converted.resulting.length !== 1 || !issued)
        throw new Error(`Certificate conversion did not create demo child for ${source.key}`);
      if (
        issued.label !== child.label ||
        issued.stakeholderId !== id(child.stakeholderKey) ||
        issued.shareClassId !== id(child.shareClassKey) ||
        issued.parentId !== id(source.key) ||
        issued.quantity !== child.quantity ||
        issued.issueDate !== child.issueDate ||
        issued.roundId !== id(child.roundKey) ||
        issued.pricePerShare == null ||
        parseFixed(issued.pricePerShare) !== parseFixed(child.pricePerShare ?? "0") ||
        issued.pricePaidPerShare == null ||
        parseFixed(issued.pricePaidPerShare) !== parseFixed(child.pricePaidPerShare ?? "0")
      )
        throw new Error(`Certificate conversion result does not match demo child ${child.key}`);
      ids.set(child.key, issued.id);
    }
  }
  // Exercised shares come from the exercise rows, not the grant's own field.
  for (const {
    key,
    stakeholderKey,
    planKey,
    vestingTemplateKey,
    historyExerciseQuantity: _historyExerciseQuantity,
    status: _status,
    canceledOn: _canceledOn,
    ...row
  } of ledger.optionGrants) {
    const created = await createEquityOptionGrant(prisma, actor, {
      ...row,
      stakeholderId: id(stakeholderKey)!,
      planId: id(planKey)!,
      vesting: row.vesting ? { ...row.vesting, templateId: id(vestingTemplateKey) } : row.vesting,
    });
    ids.set(key, created.id);
  }
  const grantsByKey = new Map(ledger.optionGrants.map((grant) => [grant.key, grant]));
  for (const { key, optionGrantKey, status, ...row } of [...ledger.exercises].sort((a, b) =>
    a.exerciseDate.localeCompare(b.exerciseDate),
  )) {
    const grant = grantsByKey.get(optionGrantKey);
    if (!grant) throw new Error(`Demo exercise ${key} has no grant`);
    if (status === "pending" && (grant.status ?? "outstanding") !== "outstanding") continue;
    const created = await createEquityExercise(prisma, actor, {
      ...row,
      optionGrantId: id(optionGrantKey)!,
      requestKey: randomUUID(),
    });
    ids.set(key, created.id);
    if (status === "completed") {
      await updateEquityExercise(prisma, actor, { id: created.id, status: "completed" });
    }
  }
  for (const grant of ledger.optionGrants.filter((row) => row.status === "canceled")) {
    if (!grant.canceledOn)
      throw new Error(`Canceled demo grant ${grant.key} has no cancellation date`);
    await cancelEquityOptionGrant(prisma, actor, {
      id: id(grant.key)!,
      canceledOn: grant.canceledOn,
      reason: "write_off_cancel",
    });
  }
  for (const grant of ledger.optionGrants.filter((row) => row.status === "forfeited")) {
    const holderGrants = ledger.optionGrants.filter(
      (row) => row.stakeholderKey === grant.stakeholderKey,
    );
    if (holderGrants.length !== 1)
      throw new Error(`Forfeited demo grant ${grant.key} needs a dedicated holder`);
    await terminateEquityStakeholder(prisma, actor, {
      stakeholderId: id(grant.stakeholderKey)!,
      terminatedOn: grant.grantDate,
    });
  }
  const expiredGrants = ledger.optionGrants.filter((row) => row.status === "expired");
  if (expiredGrants.length > 0) {
    const asOf = expiredGrants
      .map((grant) => grant.expirationDate)
      .filter((date): date is string => date != null)
      .sort()
      .at(-1);
    if (!asOf) throw new Error("Expired demo grants need expiration dates");
    const nextDay = new Date(`${asOf}T00:00:00.000Z`);
    nextDay.setUTCDate(nextDay.getUTCDate() + 1);
    const expireOn = nextDay.toISOString().slice(0, 10);
    const unexpected = ledger.optionGrants.filter(
      (grant) =>
        (grant.status ?? "outstanding") === "outstanding" &&
        grant.expirationDate != null &&
        grant.expirationDate < expireOn,
    );
    if (unexpected.length)
      throw new Error("Demo grant expiration date would close unintended outstanding grants");
    await expireEquityOptionGrants(prisma, actor, { asOf: expireOn });
  }
  for (const group of ledger.accessGroups) await setEquityAccessGroup(prisma, actor, group);
  for (const grant of ledger.accessGrants) {
    if (grant.level === null) continue; // Open requests need the holder portal (access area).
    await setEquityAccessGrant(prisma, actor, {
      stakeholderId: id(grant.stakeholderKey)!,
      level: grant.level,
    });
  }
  for (const { key: _key, ...view } of ledger.savedViews) {
    await createEquitySavedView(prisma, actor, view);
  }
  for (const { key: _key, status: _status, ...set } of ledger.draftSets) {
    // Items name rows by key; the draft holds ids. A template key has no id field on a grant.
    const items = set.items?.map((item) =>
      Object.fromEntries(
        Object.entries(item)
          .filter(([field]) => field !== "vestingTemplateKey")
          .map(([field, value]) =>
            field.endsWith("Key")
              ? [`${field.slice(0, -3)}Id`, id(value as string)]
              : [field, value],
          ),
      ),
    );
    await createEquityDraftSet(prisma, actor, { ...set, items });
  }
  // Findings come from the real checks, so each one names and links the records it is about.
  await runEquityHealthChecks(prisma, actor);
}

/**
 * The demo ledger is loaded in one go, so every change would read as recorded at the same second.
 * Spread them out as a company would have entered them: each on its effective date, during the
 * working day, in the order they were made.
 */
export async function spreadDemoEquityActivity(prisma: EquityDb, actor: EquityScope) {
  const rows = await prisma.equityTransaction.findMany({
    where: { spaceId: actor.spaceId, userId: actor.userId },
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    select: { id: true, effectiveDate: true },
  });
  for (const [index, row] of rows.entries()) {
    const at = new Date(row.effectiveDate);
    at.setUTCHours(9 + (index % 8), (index * 17) % 60);
    await prisma.equityTransaction.update({ where: { id: row.id }, data: { createdAt: at } });
  }
}
