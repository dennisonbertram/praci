-- Runs created before externalTaint existed were all set to false. Webhook and inbound
-- messaging runs carry outside content, so mark them. A paused run is requeued on the same
-- row, so an old unfinished run would otherwise resume untainted. Finished runs are marked
-- too: they cannot resume, and chained runs copy the flag from a live source.
UPDATE "runs" SET "externalTaint" = true WHERE "trigger" IN ('webhook', 'messaging');
