-- CreateTable
CREATE TABLE "legal_contracts" (
    "id" TEXT NOT NULL,
    "spaceId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "dataRoomItemId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "contractType" TEXT NOT NULL,
    "counterparties" TEXT[],
    "status" TEXT NOT NULL,
    "effectiveDate" DATE,
    "expirationDate" DATE,
    "autoRenews" BOOLEAN,
    "renewalNoticeDays" INTEGER,
    "governingLaw" TEXT,
    "valueCents" BIGINT,
    "currency" TEXT,
    "summary" TEXT,
    "analyzedRevision" INTEGER NOT NULL,
    "analyzedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "legal_contracts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "legal_deadlines" (
    "id" TEXT NOT NULL,
    "spaceId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "contractId" TEXT,
    "dataRoomItemId" TEXT,
    "title" TEXT NOT NULL,
    "dueDate" DATE NOT NULL,
    "kind" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'open',
    "sourceQuote" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "legal_deadlines_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "legal_nodes" (
    "id" TEXT NOT NULL,
    "spaceId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "attrs" JSONB,
    "contractId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "legal_nodes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "legal_edges" (
    "id" TEXT NOT NULL,
    "spaceId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "fromId" TEXT NOT NULL,
    "toId" TEXT NOT NULL,
    "relation" TEXT NOT NULL,
    "dataRoomItemId" TEXT,
    "sourceQuote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "legal_edges_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "legal_contracts_spaceId_userId_expirationDate_idx" ON "legal_contracts"("spaceId", "userId", "expirationDate");

-- CreateIndex
CREATE UNIQUE INDEX "legal_contracts_spaceId_userId_dataRoomItemId_key" ON "legal_contracts"("spaceId", "userId", "dataRoomItemId");

-- CreateIndex
CREATE INDEX "legal_deadlines_spaceId_userId_status_dueDate_idx" ON "legal_deadlines"("spaceId", "userId", "status", "dueDate");

-- CreateIndex
CREATE INDEX "legal_deadlines_contractId_idx" ON "legal_deadlines"("contractId");

-- CreateIndex
CREATE INDEX "legal_nodes_spaceId_userId_idx" ON "legal_nodes"("spaceId", "userId");

-- CreateIndex
CREATE INDEX "legal_nodes_contractId_idx" ON "legal_nodes"("contractId");

-- CreateIndex
CREATE UNIQUE INDEX "legal_nodes_spaceId_userId_kind_key_key" ON "legal_nodes"("spaceId", "userId", "kind", "key");

-- CreateIndex
CREATE INDEX "legal_edges_spaceId_userId_idx" ON "legal_edges"("spaceId", "userId");

-- CreateIndex
CREATE INDEX "legal_edges_toId_idx" ON "legal_edges"("toId");

-- CreateIndex
CREATE UNIQUE INDEX "legal_edges_fromId_toId_relation_key" ON "legal_edges"("fromId", "toId", "relation");

-- AddForeignKey
ALTER TABLE "legal_contracts" ADD CONSTRAINT "legal_contracts_dataRoomItemId_fkey" FOREIGN KEY ("dataRoomItemId") REFERENCES "data_room_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "legal_deadlines" ADD CONSTRAINT "legal_deadlines_contractId_fkey" FOREIGN KEY ("contractId") REFERENCES "legal_contracts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "legal_nodes" ADD CONSTRAINT "legal_nodes_contractId_fkey" FOREIGN KEY ("contractId") REFERENCES "legal_contracts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "legal_edges" ADD CONSTRAINT "legal_edges_fromId_fkey" FOREIGN KEY ("fromId") REFERENCES "legal_nodes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "legal_edges" ADD CONSTRAINT "legal_edges_toId_fkey" FOREIGN KEY ("toId") REFERENCES "legal_nodes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

