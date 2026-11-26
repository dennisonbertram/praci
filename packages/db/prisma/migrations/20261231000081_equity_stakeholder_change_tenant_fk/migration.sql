ALTER TABLE "equity_stakeholder_changes" ADD CONSTRAINT "equity_stakeholder_changes_stakeholderId_spaceId_userId_fkey"
  FOREIGN KEY ("stakeholderId", "spaceId", "userId") REFERENCES "equity_stakeholders"("id", "spaceId", "userId") ON DELETE NO ACTION ON UPDATE CASCADE;
