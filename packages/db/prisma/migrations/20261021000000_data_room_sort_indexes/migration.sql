-- CreateIndex
CREATE INDEX "data_room_items_spaceId_userId_createdAt_id_idx" ON "data_room_items"("spaceId", "userId", "createdAt", "id");

-- CreateIndex
CREATE INDEX "data_room_items_spaceId_userId_docDate_id_idx" ON "data_room_items"("spaceId", "userId", "docDate", "id");

-- CreateIndex
CREATE INDEX "data_room_items_spaceId_userId_name_id_idx" ON "data_room_items"("spaceId", "userId", "name", "id");

-- CreateIndex
CREATE INDEX "data_room_items_spaceId_userId_docType_id_idx" ON "data_room_items"("spaceId", "userId", "docType", "id");
