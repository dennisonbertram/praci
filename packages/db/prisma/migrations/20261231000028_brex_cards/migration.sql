-- Brex cards: the owner's hard controls and the durable daily-cap reservations.


-- CreateEnum
CREATE TYPE "BrexCardReservationStatus" AS ENUM ('reserved', 'created', 'failed', 'uncertain');

-- CreateTable
CREATE TABLE "brex_cards_connections" (
    "serverId" TEXT NOT NULL,
    "spaceId" TEXT NOT NULL,
    "createdByUserId" TEXT NOT NULL,
    "brexAccountId" TEXT NOT NULL,
    "maxNewCardLimitCents" INTEGER NOT NULL DEFAULT 100000,
    "maxCardLimitCents" INTEGER NOT NULL DEFAULT 500000,
    "maxSpendLimitBaseCents" INTEGER NOT NULL DEFAULT 1000000,
    "maxCardsPerDay" INTEGER NOT NULL DEFAULT 5,
    "allowedDurations" TEXT[] DEFAULT ARRAY['MONTHLY', 'ONE_TIME']::TEXT[],
    "oneTimeMaxDays" INTEGER DEFAULT 90,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "brex_cards_connections_pkey" PRIMARY KEY ("serverId")
);

-- CreateTable
CREATE TABLE "brex_card_reservations" (
    "id" TEXT NOT NULL,
    "spaceId" TEXT NOT NULL,
    "brexAccountId" TEXT NOT NULL,
    "reservedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "status" "BrexCardReservationStatus" NOT NULL,
    "brexCardId" TEXT,

    CONSTRAINT "brex_card_reservations_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "brex_cards_connections_spaceId_key" ON "brex_cards_connections"("spaceId");

-- CreateIndex
CREATE INDEX "brex_card_reservations_brexAccountId_reservedAt_idx" ON "brex_card_reservations"("brexAccountId", "reservedAt");

-- AddForeignKey
ALTER TABLE "brex_cards_connections" ADD CONSTRAINT "brex_cards_connections_serverId_fkey" FOREIGN KEY ("serverId") REFERENCES "mcp_servers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "brex_card_reservations" ADD CONSTRAINT "brex_card_reservations_spaceId_fkey" FOREIGN KEY ("spaceId") REFERENCES "spaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- Row-level security, as for the other space tables.
ALTER TABLE "brex_cards_connections" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "brex_cards_connections_tenant" ON "brex_cards_connections"
  USING ("spaceId" = NULLIF(current_setting('app.space_id', true), ''));
CREATE POLICY "brex_cards_connections_system" ON "brex_cards_connections"
  USING (current_setting('app.rls_bypass', true) = 'on');

ALTER TABLE "brex_card_reservations" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "brex_card_reservations_tenant" ON "brex_card_reservations"
  USING ("spaceId" = NULLIF(current_setting('app.space_id', true), ''));
CREATE POLICY "brex_card_reservations_system" ON "brex_card_reservations"
  USING (current_setting('app.rls_bypass', true) = 'on');
