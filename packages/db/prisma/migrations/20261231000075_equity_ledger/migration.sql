-- Cap table ledger (foundation). Every equity_* row hangs off one equity_ledgers row per (space, user)
-- through a composite foreign key, so a row and what it points at stay in one tenant's ledger.

-- CreateTable
CREATE TABLE "equity_ledgers" (
    "id" TEXT NOT NULL,
    "spaceId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "importedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "equity_ledgers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "equity_stakeholders" (
    "id" TEXT NOT NULL,
    "spaceId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "firstName" TEXT,
    "lastName" TEXT,
    "contactEmail" TEXT,
    "portfolioEmail" TEXT,
    "portfolioEmailLockedAt" TIMESTAMP(3),
    "otherEmails" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "dateOfBirth" DATE,
    "taxId" TEXT,
    "employeeId" TEXT,
    "payrollId" TEXT,
    "addresses" JSONB NOT NULL DEFAULT '[]',
    "relationship" TEXT,
    "jobTitle" TEXT,
    "costCenter" TEXT,
    "department" TEXT,
    "customValues" JSONB NOT NULL DEFAULT '{}',
    "parentId" TEXT,
    "contactId" TEXT,
    "majorInvestor" BOOLEAN NOT NULL DEFAULT false,
    "terminatedAt" DATE,
    "mergedIntoId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "equity_stakeholders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "equity_stakeholder_properties" (
    "id" TEXT NOT NULL,
    "spaceId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "stakeholderId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "effectiveDate" DATE NOT NULL,
    "value" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "equity_stakeholder_properties_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "equity_custom_properties" (
    "id" TEXT NOT NULL,
    "spaceId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "hrisField" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "equity_custom_properties_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "equity_share_classes" (
    "id" TEXT NOT NULL,
    "spaceId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "prefix" TEXT NOT NULL,
    "classType" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "equity_share_classes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "equity_share_class_versions" (
    "id" TEXT NOT NULL,
    "spaceId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "shareClassId" TEXT NOT NULL,
    "documentDate" DATE NOT NULL,
    "authorizedShares" BIGINT NOT NULL,
    "votesPerShare" DECIMAL(24,10) NOT NULL DEFAULT 1,
    "certificated" BOOLEAN NOT NULL DEFAULT true,
    "parValue" DECIMAL(24,10),
    "seniority" INTEGER NOT NULL DEFAULT 1,
    "pariPassu" BOOLEAN NOT NULL DEFAULT true,
    "originalIssuePrice" DECIMAL(24,10),
    "conversionPrice" DECIMAL(24,10),
    "conversionRatio" DECIMAL(24,10) NOT NULL DEFAULT 1,
    "multiplier" DECIMAL(24,10) NOT NULL DEFAULT 1,
    "participating" BOOLEAN NOT NULL DEFAULT false,
    "participationCap" DECIMAL(24,10),
    "dividend" BOOLEAN NOT NULL DEFAULT false,
    "dividendYield" DECIMAL(24,10),
    "cumulative" BOOLEAN NOT NULL DEFAULT false,
    "dividendAccrual" TEXT,
    "compoundingInterest" BOOLEAN NOT NULL DEFAULT false,
    "dayCountConvention" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "equity_share_class_versions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "equity_plans" (
    "id" TEXT NOT NULL,
    "spaceId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'active',
    "shareClassId" TEXT NOT NULL,
    "reservedShares" BIGINT NOT NULL,
    "boardApprovedOn" DATE,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "equity_plans_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "equity_vesting_templates" (
    "id" TEXT NOT NULL,
    "spaceId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "totalMonths" INTEGER NOT NULL,
    "cliffMonths" INTEGER NOT NULL DEFAULT 0,
    "frequencyMonths" INTEGER NOT NULL DEFAULT 1,
    "tranches" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "equity_vesting_templates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "equity_vesting_schedules" (
    "id" TEXT NOT NULL,
    "spaceId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "templateId" TEXT,
    "startDate" DATE NOT NULL,
    "totalMonths" INTEGER NOT NULL,
    "cliffMonths" INTEGER NOT NULL DEFAULT 0,
    "frequencyMonths" INTEGER NOT NULL DEFAULT 1,
    "tranches" JSONB,
    "acceleratedShares" BIGINT,
    "acceleratedOn" DATE,
    "stoppedOn" DATE,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "equity_vesting_schedules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "equity_certificates" (
    "id" TEXT NOT NULL,
    "spaceId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "stakeholderId" TEXT NOT NULL,
    "shareClassId" TEXT NOT NULL,
    "planId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'outstanding',
    "acceptanceStatus" TEXT NOT NULL DEFAULT 'accepted',
    "paperStatus" TEXT NOT NULL DEFAULT 'electronic',
    "quantity" BIGINT NOT NULL,
    "pricePerShare" DECIMAL(24,10),
    "pricePaidPerShare" DECIMAL(24,10),
    "cashPaidCents" BIGINT NOT NULL DEFAULT 0,
    "debtCanceledCents" BIGINT NOT NULL DEFAULT 0,
    "ipTransferredCents" BIGINT NOT NULL DEFAULT 0,
    "otherConsiderationCents" BIGINT NOT NULL DEFAULT 0,
    "costBasisCents" BIGINT,
    "issueDate" DATE NOT NULL,
    "originalAcquisitionDate" DATE,
    "issuedBy" TEXT,
    "boardApprovedOn" DATE,
    "rule144Date" DATE,
    "federalExemption" TEXT,
    "stateExemption" TEXT,
    "stateOfResidency" TEXT,
    "legend" TEXT,
    "personnel" JSONB,
    "collateralized" BOOLEAN NOT NULL DEFAULT false,
    "vestingScheduleId" TEXT,
    "parentId" TEXT,
    "roundId" TEXT,
    "canceledOn" DATE,
    "adminNotes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "equity_certificates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "equity_convertible_blocks" (
    "id" TEXT NOT NULL,
    "spaceId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "equity_convertible_blocks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "equity_convertibles" (
    "id" TEXT NOT NULL,
    "spaceId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "stakeholderId" TEXT NOT NULL,
    "blockId" TEXT,
    "kind" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'outstanding',
    "principalCents" BIGINT NOT NULL,
    "issueDate" DATE NOT NULL,
    "issuedBy" TEXT,
    "boardApprovedOn" DATE,
    "interestRate" DECIMAL(24,10),
    "interestStartDate" DATE,
    "interestType" TEXT,
    "dayCountConvention" TEXT,
    "maturityDate" DATE,
    "valuationCapCents" BIGINT,
    "valuationCapType" TEXT,
    "discountPercent" DECIMAL(24,10),
    "conversionPriceBasis" TEXT,
    "liquidityPriority" TEXT,
    "convertsToShareClassId" TEXT,
    "cashoutMultiplier" DECIMAL(24,10),
    "mfn" BOOLEAN NOT NULL DEFAULT false,
    "proRata" BOOLEAN NOT NULL DEFAULT false,
    "federalExemption" TEXT,
    "stateExemption" TEXT,
    "stateOfResidency" TEXT,
    "canceledOn" DATE,
    "cancellationReason" TEXT,
    "convertedToId" TEXT,
    "roundId" TEXT,
    "adminNotes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "equity_convertibles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "equity_option_grants" (
    "id" TEXT NOT NULL,
    "spaceId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "stakeholderId" TEXT NOT NULL,
    "planId" TEXT NOT NULL,
    "shareClassId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'outstanding',
    "optionType" TEXT NOT NULL,
    "quantity" BIGINT NOT NULL,
    "exercisedQuantity" BIGINT NOT NULL DEFAULT 0,
    "canceledQuantity" BIGINT NOT NULL DEFAULT 0,
    "exercisePrice" DECIMAL(24,10) NOT NULL,
    "grantDate" DATE NOT NULL,
    "expirationDate" DATE,
    "boardApprovedOn" DATE,
    "postTerminationExerciseMonths" INTEGER,
    "earlyExercise" BOOLEAN NOT NULL DEFAULT false,
    "acceptanceStatus" TEXT NOT NULL DEFAULT 'accepted',
    "vestingScheduleId" TEXT,
    "canceledOn" DATE,
    "adminNotes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "equity_option_grants_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "equity_exercises" (
    "id" TEXT NOT NULL,
    "spaceId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "optionGrantId" TEXT NOT NULL,
    "quantity" BIGINT NOT NULL,
    "exerciseDate" DATE NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "paymentCents" BIGINT NOT NULL DEFAULT 0,
    "certificateId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "equity_exercises_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "equity_transactions" (
    "id" TEXT NOT NULL,
    "spaceId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "effectiveDate" DATE NOT NULL,
    "reason" TEXT,
    "certificateId" TEXT,
    "convertibleId" TEXT,
    "optionGrantId" TEXT,
    "planId" TEXT,
    "quantity" BIGINT,
    "valueCents" BIGINT,
    "before" JSONB,
    "after" JSONB,
    "resulting" JSONB NOT NULL DEFAULT '[]',
    "note" TEXT,
    "actorName" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "equity_transactions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "equity_draft_sets" (
    "id" TEXT NOT NULL,
    "spaceId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "securityKind" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "items" JSONB NOT NULL DEFAULT '[]',
    "issuedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "equity_draft_sets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "equity_funding_rounds" (
    "id" TEXT NOT NULL,
    "spaceId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "startDate" DATE NOT NULL,
    "endDate" DATE,
    "closingDate" DATE,
    "originalIssuePrice" DECIMAL(24,10),
    "preMoneyValuationCents" BIGINT,
    "overrides" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "equity_funding_rounds_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "equity_saved_views" (
    "id" TEXT NOT NULL,
    "spaceId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "page" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "params" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "equity_saved_views_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "equity_access_groups" (
    "id" TEXT NOT NULL,
    "spaceId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "level" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "equity_access_groups_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "equity_access_grants" (
    "id" TEXT NOT NULL,
    "spaceId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "stakeholderId" TEXT NOT NULL,
    "level" TEXT,
    "requestedLevel" TEXT,
    "requestedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "equity_access_grants_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "equity_health_findings" (
    "id" TEXT NOT NULL,
    "spaceId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "check" TEXT NOT NULL,
    "tag" TEXT NOT NULL,
    "severity" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'open',
    "fingerprint" TEXT NOT NULL,
    "rows" JSONB NOT NULL DEFAULT '[]',
    "detectedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "dismissedAt" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "equity_health_findings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "equity_ledgers_spaceId_userId_key" ON "equity_ledgers"("spaceId", "userId");

-- CreateIndex
CREATE INDEX "equity_stakeholders_spaceId_userId_name_idx" ON "equity_stakeholders"("spaceId", "userId", "name");

-- CreateIndex
CREATE INDEX "equity_stakeholders_spaceId_userId_relationship_idx" ON "equity_stakeholders"("spaceId", "userId", "relationship");

-- CreateIndex
CREATE INDEX "equity_stakeholders_contactId_idx" ON "equity_stakeholders"("contactId");

-- CreateIndex
CREATE UNIQUE INDEX "equity_stakeholders_id_spaceId_userId_key" ON "equity_stakeholders"("id", "spaceId", "userId");

-- CreateIndex
CREATE INDEX "equity_stakeholder_properties_stakeholderId_kind_effectiveD_idx" ON "equity_stakeholder_properties"("stakeholderId", "kind", "effectiveDate");

-- CreateIndex
CREATE UNIQUE INDEX "equity_custom_properties_spaceId_userId_name_key" ON "equity_custom_properties"("spaceId", "userId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "equity_share_classes_id_spaceId_userId_key" ON "equity_share_classes"("id", "spaceId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "equity_share_classes_spaceId_userId_name_key" ON "equity_share_classes"("spaceId", "userId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "equity_share_classes_spaceId_userId_prefix_key" ON "equity_share_classes"("spaceId", "userId", "prefix");

-- CreateIndex
CREATE UNIQUE INDEX "equity_share_class_versions_shareClassId_documentDate_key" ON "equity_share_class_versions"("shareClassId", "documentDate");

-- CreateIndex
CREATE UNIQUE INDEX "equity_plans_id_spaceId_userId_key" ON "equity_plans"("id", "spaceId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "equity_plans_spaceId_userId_name_key" ON "equity_plans"("spaceId", "userId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "equity_vesting_templates_spaceId_userId_name_key" ON "equity_vesting_templates"("spaceId", "userId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "equity_certificates_vestingScheduleId_key" ON "equity_certificates"("vestingScheduleId");

-- CreateIndex
CREATE INDEX "equity_certificates_spaceId_userId_status_idx" ON "equity_certificates"("spaceId", "userId", "status");

-- CreateIndex
CREATE INDEX "equity_certificates_stakeholderId_idx" ON "equity_certificates"("stakeholderId");

-- CreateIndex
CREATE INDEX "equity_certificates_shareClassId_idx" ON "equity_certificates"("shareClassId");

-- CreateIndex
CREATE UNIQUE INDEX "equity_certificates_id_spaceId_userId_key" ON "equity_certificates"("id", "spaceId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "equity_certificates_spaceId_userId_label_key" ON "equity_certificates"("spaceId", "userId", "label");

-- CreateIndex
CREATE UNIQUE INDEX "equity_convertible_blocks_spaceId_userId_name_key" ON "equity_convertible_blocks"("spaceId", "userId", "name");

-- CreateIndex
CREATE INDEX "equity_convertibles_spaceId_userId_status_idx" ON "equity_convertibles"("spaceId", "userId", "status");

-- CreateIndex
CREATE INDEX "equity_convertibles_stakeholderId_idx" ON "equity_convertibles"("stakeholderId");

-- CreateIndex
CREATE UNIQUE INDEX "equity_convertibles_id_spaceId_userId_key" ON "equity_convertibles"("id", "spaceId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "equity_convertibles_spaceId_userId_label_key" ON "equity_convertibles"("spaceId", "userId", "label");

-- CreateIndex
CREATE UNIQUE INDEX "equity_option_grants_vestingScheduleId_key" ON "equity_option_grants"("vestingScheduleId");

-- CreateIndex
CREATE INDEX "equity_option_grants_spaceId_userId_status_idx" ON "equity_option_grants"("spaceId", "userId", "status");

-- CreateIndex
CREATE INDEX "equity_option_grants_stakeholderId_idx" ON "equity_option_grants"("stakeholderId");

-- CreateIndex
CREATE INDEX "equity_option_grants_planId_idx" ON "equity_option_grants"("planId");

-- CreateIndex
CREATE UNIQUE INDEX "equity_option_grants_id_spaceId_userId_key" ON "equity_option_grants"("id", "spaceId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "equity_option_grants_spaceId_userId_label_key" ON "equity_option_grants"("spaceId", "userId", "label");

-- CreateIndex
CREATE INDEX "equity_exercises_optionGrantId_idx" ON "equity_exercises"("optionGrantId");

-- CreateIndex
CREATE INDEX "equity_transactions_spaceId_userId_createdAt_idx" ON "equity_transactions"("spaceId", "userId", "createdAt");

-- CreateIndex
CREATE INDEX "equity_transactions_certificateId_idx" ON "equity_transactions"("certificateId");

-- CreateIndex
CREATE INDEX "equity_transactions_convertibleId_idx" ON "equity_transactions"("convertibleId");

-- CreateIndex
CREATE INDEX "equity_transactions_optionGrantId_idx" ON "equity_transactions"("optionGrantId");

-- CreateIndex
CREATE INDEX "equity_draft_sets_spaceId_userId_status_idx" ON "equity_draft_sets"("spaceId", "userId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "equity_funding_rounds_spaceId_userId_name_key" ON "equity_funding_rounds"("spaceId", "userId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "equity_saved_views_spaceId_userId_page_name_key" ON "equity_saved_views"("spaceId", "userId", "page", "name");

-- CreateIndex
CREATE UNIQUE INDEX "equity_access_groups_spaceId_userId_key_key" ON "equity_access_groups"("spaceId", "userId", "key");

-- CreateIndex
CREATE UNIQUE INDEX "equity_access_grants_stakeholderId_spaceId_userId_key" ON "equity_access_grants"("stakeholderId", "spaceId", "userId");

-- CreateIndex
CREATE INDEX "equity_health_findings_spaceId_userId_status_idx" ON "equity_health_findings"("spaceId", "userId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "equity_health_findings_spaceId_userId_check_fingerprint_key" ON "equity_health_findings"("spaceId", "userId", "check", "fingerprint");

-- AddForeignKey
ALTER TABLE "equity_ledgers" ADD CONSTRAINT "equity_ledgers_spaceId_fkey" FOREIGN KEY ("spaceId") REFERENCES "spaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "equity_ledgers" ADD CONSTRAINT "equity_ledgers_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "equity_stakeholders" ADD CONSTRAINT "equity_stakeholders_spaceId_userId_fkey" FOREIGN KEY ("spaceId", "userId") REFERENCES "equity_ledgers"("spaceId", "userId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "equity_stakeholders" ADD CONSTRAINT "equity_stakeholders_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "equity_stakeholders"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "equity_stakeholders" ADD CONSTRAINT "equity_stakeholders_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "contacts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "equity_stakeholder_properties" ADD CONSTRAINT "equity_stakeholder_properties_spaceId_userId_fkey" FOREIGN KEY ("spaceId", "userId") REFERENCES "equity_ledgers"("spaceId", "userId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "equity_stakeholder_properties" ADD CONSTRAINT "equity_stakeholder_properties_stakeholderId_spaceId_userId_fkey" FOREIGN KEY ("stakeholderId", "spaceId", "userId") REFERENCES "equity_stakeholders"("id", "spaceId", "userId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "equity_custom_properties" ADD CONSTRAINT "equity_custom_properties_spaceId_userId_fkey" FOREIGN KEY ("spaceId", "userId") REFERENCES "equity_ledgers"("spaceId", "userId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "equity_share_classes" ADD CONSTRAINT "equity_share_classes_spaceId_userId_fkey" FOREIGN KEY ("spaceId", "userId") REFERENCES "equity_ledgers"("spaceId", "userId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "equity_share_class_versions" ADD CONSTRAINT "equity_share_class_versions_spaceId_userId_fkey" FOREIGN KEY ("spaceId", "userId") REFERENCES "equity_ledgers"("spaceId", "userId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "equity_share_class_versions" ADD CONSTRAINT "equity_share_class_versions_shareClassId_spaceId_userId_fkey" FOREIGN KEY ("shareClassId", "spaceId", "userId") REFERENCES "equity_share_classes"("id", "spaceId", "userId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "equity_plans" ADD CONSTRAINT "equity_plans_spaceId_userId_fkey" FOREIGN KEY ("spaceId", "userId") REFERENCES "equity_ledgers"("spaceId", "userId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "equity_plans" ADD CONSTRAINT "equity_plans_shareClassId_spaceId_userId_fkey" FOREIGN KEY ("shareClassId", "spaceId", "userId") REFERENCES "equity_share_classes"("id", "spaceId", "userId") ON DELETE NO ACTION ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "equity_vesting_templates" ADD CONSTRAINT "equity_vesting_templates_spaceId_userId_fkey" FOREIGN KEY ("spaceId", "userId") REFERENCES "equity_ledgers"("spaceId", "userId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "equity_vesting_schedules" ADD CONSTRAINT "equity_vesting_schedules_spaceId_userId_fkey" FOREIGN KEY ("spaceId", "userId") REFERENCES "equity_ledgers"("spaceId", "userId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "equity_vesting_schedules" ADD CONSTRAINT "equity_vesting_schedules_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "equity_vesting_templates"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "equity_certificates" ADD CONSTRAINT "equity_certificates_spaceId_userId_fkey" FOREIGN KEY ("spaceId", "userId") REFERENCES "equity_ledgers"("spaceId", "userId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "equity_certificates" ADD CONSTRAINT "equity_certificates_stakeholderId_spaceId_userId_fkey" FOREIGN KEY ("stakeholderId", "spaceId", "userId") REFERENCES "equity_stakeholders"("id", "spaceId", "userId") ON DELETE NO ACTION ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "equity_certificates" ADD CONSTRAINT "equity_certificates_shareClassId_spaceId_userId_fkey" FOREIGN KEY ("shareClassId", "spaceId", "userId") REFERENCES "equity_share_classes"("id", "spaceId", "userId") ON DELETE NO ACTION ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "equity_certificates" ADD CONSTRAINT "equity_certificates_planId_fkey" FOREIGN KEY ("planId") REFERENCES "equity_plans"("id") ON DELETE NO ACTION ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "equity_certificates" ADD CONSTRAINT "equity_certificates_vestingScheduleId_fkey" FOREIGN KEY ("vestingScheduleId") REFERENCES "equity_vesting_schedules"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "equity_certificates" ADD CONSTRAINT "equity_certificates_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "equity_certificates"("id") ON DELETE NO ACTION ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "equity_certificates" ADD CONSTRAINT "equity_certificates_roundId_fkey" FOREIGN KEY ("roundId") REFERENCES "equity_funding_rounds"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "equity_convertible_blocks" ADD CONSTRAINT "equity_convertible_blocks_spaceId_userId_fkey" FOREIGN KEY ("spaceId", "userId") REFERENCES "equity_ledgers"("spaceId", "userId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "equity_convertibles" ADD CONSTRAINT "equity_convertibles_spaceId_userId_fkey" FOREIGN KEY ("spaceId", "userId") REFERENCES "equity_ledgers"("spaceId", "userId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "equity_convertibles" ADD CONSTRAINT "equity_convertibles_stakeholderId_spaceId_userId_fkey" FOREIGN KEY ("stakeholderId", "spaceId", "userId") REFERENCES "equity_stakeholders"("id", "spaceId", "userId") ON DELETE NO ACTION ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "equity_convertibles" ADD CONSTRAINT "equity_convertibles_blockId_fkey" FOREIGN KEY ("blockId") REFERENCES "equity_convertible_blocks"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "equity_convertibles" ADD CONSTRAINT "equity_convertibles_convertsToShareClassId_fkey" FOREIGN KEY ("convertsToShareClassId") REFERENCES "equity_share_classes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "equity_convertibles" ADD CONSTRAINT "equity_convertibles_convertedToId_fkey" FOREIGN KEY ("convertedToId") REFERENCES "equity_certificates"("id") ON DELETE NO ACTION ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "equity_convertibles" ADD CONSTRAINT "equity_convertibles_roundId_fkey" FOREIGN KEY ("roundId") REFERENCES "equity_funding_rounds"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "equity_option_grants" ADD CONSTRAINT "equity_option_grants_spaceId_userId_fkey" FOREIGN KEY ("spaceId", "userId") REFERENCES "equity_ledgers"("spaceId", "userId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "equity_option_grants" ADD CONSTRAINT "equity_option_grants_stakeholderId_spaceId_userId_fkey" FOREIGN KEY ("stakeholderId", "spaceId", "userId") REFERENCES "equity_stakeholders"("id", "spaceId", "userId") ON DELETE NO ACTION ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "equity_option_grants" ADD CONSTRAINT "equity_option_grants_planId_spaceId_userId_fkey" FOREIGN KEY ("planId", "spaceId", "userId") REFERENCES "equity_plans"("id", "spaceId", "userId") ON DELETE NO ACTION ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "equity_option_grants" ADD CONSTRAINT "equity_option_grants_shareClassId_spaceId_userId_fkey" FOREIGN KEY ("shareClassId", "spaceId", "userId") REFERENCES "equity_share_classes"("id", "spaceId", "userId") ON DELETE NO ACTION ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "equity_option_grants" ADD CONSTRAINT "equity_option_grants_vestingScheduleId_fkey" FOREIGN KEY ("vestingScheduleId") REFERENCES "equity_vesting_schedules"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "equity_exercises" ADD CONSTRAINT "equity_exercises_spaceId_userId_fkey" FOREIGN KEY ("spaceId", "userId") REFERENCES "equity_ledgers"("spaceId", "userId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "equity_exercises" ADD CONSTRAINT "equity_exercises_optionGrantId_spaceId_userId_fkey" FOREIGN KEY ("optionGrantId", "spaceId", "userId") REFERENCES "equity_option_grants"("id", "spaceId", "userId") ON DELETE NO ACTION ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "equity_exercises" ADD CONSTRAINT "equity_exercises_certificateId_fkey" FOREIGN KEY ("certificateId") REFERENCES "equity_certificates"("id") ON DELETE NO ACTION ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "equity_transactions" ADD CONSTRAINT "equity_transactions_spaceId_userId_fkey" FOREIGN KEY ("spaceId", "userId") REFERENCES "equity_ledgers"("spaceId", "userId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "equity_transactions" ADD CONSTRAINT "equity_transactions_certificateId_fkey" FOREIGN KEY ("certificateId") REFERENCES "equity_certificates"("id") ON DELETE NO ACTION ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "equity_transactions" ADD CONSTRAINT "equity_transactions_convertibleId_fkey" FOREIGN KEY ("convertibleId") REFERENCES "equity_convertibles"("id") ON DELETE NO ACTION ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "equity_transactions" ADD CONSTRAINT "equity_transactions_optionGrantId_fkey" FOREIGN KEY ("optionGrantId") REFERENCES "equity_option_grants"("id") ON DELETE NO ACTION ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "equity_transactions" ADD CONSTRAINT "equity_transactions_planId_fkey" FOREIGN KEY ("planId") REFERENCES "equity_plans"("id") ON DELETE NO ACTION ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "equity_draft_sets" ADD CONSTRAINT "equity_draft_sets_spaceId_userId_fkey" FOREIGN KEY ("spaceId", "userId") REFERENCES "equity_ledgers"("spaceId", "userId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "equity_funding_rounds" ADD CONSTRAINT "equity_funding_rounds_spaceId_userId_fkey" FOREIGN KEY ("spaceId", "userId") REFERENCES "equity_ledgers"("spaceId", "userId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "equity_saved_views" ADD CONSTRAINT "equity_saved_views_spaceId_userId_fkey" FOREIGN KEY ("spaceId", "userId") REFERENCES "equity_ledgers"("spaceId", "userId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "equity_access_groups" ADD CONSTRAINT "equity_access_groups_spaceId_userId_fkey" FOREIGN KEY ("spaceId", "userId") REFERENCES "equity_ledgers"("spaceId", "userId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "equity_access_grants" ADD CONSTRAINT "equity_access_grants_spaceId_userId_fkey" FOREIGN KEY ("spaceId", "userId") REFERENCES "equity_ledgers"("spaceId", "userId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "equity_access_grants" ADD CONSTRAINT "equity_access_grants_stakeholderId_spaceId_userId_fkey" FOREIGN KEY ("stakeholderId", "spaceId", "userId") REFERENCES "equity_stakeholders"("id", "spaceId", "userId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "equity_health_findings" ADD CONSTRAINT "equity_health_findings_spaceId_userId_fkey" FOREIGN KEY ("spaceId", "userId") REFERENCES "equity_ledgers"("spaceId", "userId") ON DELETE CASCADE ON UPDATE CASCADE;


-- Row-level security, as for the other tenant tables. equity_transactions is append-only for the app:
-- the tenant may read and insert, never update or delete; the system bypass keeps full access.
DO $$
DECLARE
  protected text;
BEGIN
  FOREACH protected IN ARRAY ARRAY[
    'equity_ledgers',
    'equity_stakeholders',
    'equity_stakeholder_properties',
    'equity_custom_properties',
    'equity_share_classes',
    'equity_share_class_versions',
    'equity_plans',
    'equity_vesting_templates',
    'equity_vesting_schedules',
    'equity_certificates',
    'equity_convertible_blocks',
    'equity_convertibles',
    'equity_option_grants',
    'equity_exercises',
    'equity_draft_sets',
    'equity_funding_rounds',
    'equity_saved_views',
    'equity_access_groups',
    'equity_access_grants',
    'equity_health_findings'
  ] LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', protected);
    EXECUTE format(
      'CREATE POLICY %I ON %I USING ("spaceId" = NULLIF(current_setting(''app.space_id'', true), '''') AND "userId" = NULLIF(current_setting(''app.user_id'', true), ''''))',
      protected || '_tenant', protected);
    EXECUTE format(
      'CREATE POLICY %I ON %I USING (current_setting(''app.rls_bypass'', true) = ''on'')',
      protected || '_system', protected);
  END LOOP;
END $$;

ALTER TABLE "equity_transactions" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "equity_transactions_tenant" ON "equity_transactions" FOR SELECT
  USING ("spaceId" = NULLIF(current_setting('app.space_id', true), '')
    AND "userId" = NULLIF(current_setting('app.user_id', true), ''));
CREATE POLICY "equity_transactions_tenant_insert" ON "equity_transactions" FOR INSERT
  WITH CHECK ("spaceId" = NULLIF(current_setting('app.space_id', true), '')
    AND "userId" = NULLIF(current_setting('app.user_id', true), ''));
CREATE POLICY "equity_transactions_system" ON "equity_transactions"
  USING (current_setting('app.rls_bypass', true) = 'on');
