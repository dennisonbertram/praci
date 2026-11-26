-- Whether and how meetings may be recorded in a space. Enforced by the API when a capture starts.
ALTER TABLE "spaces" ADD COLUMN "meetingRecording" TEXT NOT NULL DEFAULT 'remind';
ALTER TABLE "spaces" ADD CONSTRAINT "spaces_meetingRecording_chk" CHECK ("meetingRecording" IN ('remind', 'confirm', 'off'));
