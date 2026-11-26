-- The kind of meeting, set from the digest call. NOT VALID: the new column is all NULL, so skip the table scan; new writes are still checked.
ALTER TABLE "meetings" ADD COLUMN "category" TEXT;
ALTER TABLE "meetings" ADD CONSTRAINT "meetings_category_chk" CHECK ("category" IN ('investor', 'customer', 'hiring', 'team', 'other')) NOT VALID;
