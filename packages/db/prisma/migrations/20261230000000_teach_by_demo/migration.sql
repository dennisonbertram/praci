ALTER TABLE "taught_skills"
  ADD COLUMN "lastRunAt" TIMESTAMP(3),
  ADD COLUMN "lastTestRunId" TEXT,
  ADD COLUMN "lastTestOutcome" TEXT,
  ADD COLUMN "lastTestNote" TEXT;

ALTER TABLE "routines" ADD COLUMN "taughtSkillId" TEXT;
ALTER TABLE "routines"
  ADD CONSTRAINT "routines_taughtSkillId_fkey"
  FOREIGN KEY ("taughtSkillId") REFERENCES "taught_skills"("id") ON DELETE SET NULL ON UPDATE CASCADE;
CREATE INDEX "routines_taughtSkillId_idx" ON "routines" ("taughtSkillId");

CREATE TABLE "teach_held_values" (
  "id" TEXT NOT NULL,
  "skillId" TEXT NOT NULL,
  "spaceId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "segment" INTEGER NOT NULL,
  "stepIndex" INTEGER,
  "field" TEXT NOT NULL DEFAULT '',
  "ciphertext" TEXT NOT NULL,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "teach_held_values_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "teach_held_values_skillId_segment_key" ON "teach_held_values" ("skillId", "segment");
CREATE INDEX "teach_held_values_expiresAt_idx" ON "teach_held_values" ("expiresAt");
ALTER TABLE "teach_held_values"
  ADD CONSTRAINT "teach_held_values_skillId_fkey"
  FOREIGN KEY ("skillId") REFERENCES "taught_skills"("id") ON DELETE CASCADE ON UPDATE CASCADE;
