-- Bot audience: every existing bot stays internal. External bots get a closed tool list,
-- may message only the internal bots in externalMessageTargets, and have the computer off.
ALTER TABLE "bots" ADD COLUMN "audience" TEXT NOT NULL DEFAULT 'internal';
ALTER TABLE "bots" ADD COLUMN "externalMessageTargets" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
ALTER TABLE "bots" ADD COLUMN "externalComputerTools" BOOLEAN NOT NULL DEFAULT false;
