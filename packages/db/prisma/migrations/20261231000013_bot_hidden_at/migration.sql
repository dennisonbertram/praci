-- A bot the person left out of the sidebar chat list; it keeps working.
ALTER TABLE "bots" ADD COLUMN "hiddenAt" TIMESTAMP(3);
