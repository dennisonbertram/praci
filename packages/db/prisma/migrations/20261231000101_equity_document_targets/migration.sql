ALTER TABLE "equity_document_links" ADD CONSTRAINT "equity_document_links_dataRoomItemId_spaceId_userId_fkey"
  FOREIGN KEY ("dataRoomItemId", "spaceId", "userId")
  REFERENCES "data_room_items"("id", "spaceId", "userId")
  ON DELETE NO ACTION ON UPDATE CASCADE;
ALTER TABLE "equity_document_links" ADD CONSTRAINT "equity_document_links_stakeholderId_spaceId_userId_fkey"
  FOREIGN KEY ("stakeholderId", "spaceId", "userId")
  REFERENCES "equity_stakeholders"("id", "spaceId", "userId")
  ON DELETE NO ACTION ON UPDATE CASCADE;
ALTER TABLE "equity_document_links" ADD CONSTRAINT "equity_document_links_certificateId_spaceId_userId_fkey"
  FOREIGN KEY ("certificateId", "spaceId", "userId")
  REFERENCES "equity_certificates"("id", "spaceId", "userId")
  ON DELETE NO ACTION ON UPDATE CASCADE;
ALTER TABLE "equity_document_links" ADD CONSTRAINT "equity_document_links_roundId_spaceId_userId_fkey"
  FOREIGN KEY ("roundId", "spaceId", "userId")
  REFERENCES "equity_funding_rounds"("id", "spaceId", "userId")
  ON DELETE NO ACTION ON UPDATE CASCADE;
