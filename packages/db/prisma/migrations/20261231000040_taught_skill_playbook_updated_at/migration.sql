-- When a taught skill's playbook last changed. Existing rows start at their creation time.
ALTER TABLE "taught_skills" ADD COLUMN "playbookUpdatedAt" TIMESTAMP(3);
UPDATE "taught_skills" SET "playbookUpdatedAt" = "createdAt";
