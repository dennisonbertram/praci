-- Hide amounts follows the person, not the browser.
ALTER TABLE "user" ADD COLUMN "hideAmounts" BOOLEAN NOT NULL DEFAULT false;
