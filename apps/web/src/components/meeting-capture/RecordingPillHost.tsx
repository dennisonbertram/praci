import { useEffect, useState, useSyncExternalStore } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { systemAudioSupported } from "../../lib/meeting-capture/availability";
import {
  captureView,
  dismissStored,
  recoverCapture,
  shareTabAudio,
  stopCapture,
  subscribeCapture,
} from "../../lib/meeting-capture/controller";
import { defaultMeetingTitle } from "../../lib/meeting-capture/title";
import { RecordingPill } from "./RecordingPill";

/** Shows the recording pill on every page while a capture runs, and picks up one left by a reload. */
export function RecordingPillHost() {
  const view = useSyncExternalStore(subscribeCapture, captureView);
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    void recoverCapture();
  }, []);
  useEffect(() => {
    if (view.phase !== "recording") return;
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [view.phase]);
  // A stored meeting opens only for someone already looking at the list.
  useEffect(() => {
    if (view.phase !== "stored") return;
    if (view.meetingId && pathname === "/app/meetings") navigate(`/app/meetings/${view.meetingId}`);
    dismissStored();
  }, [view, pathname, navigate]);

  if (view.phase === "idle" || view.phase === "stored") return null;
  return (
    <div className="flex shrink-0 justify-center px-2 pt-2">
      {view.phase === "failed" ? (
        <RecordingPill
          state={{ kind: "failed", message: view.message }}
          onStop={() => undefined}
          onDismiss={dismissStored}
        />
      ) : view.phase === "transcribing" ? (
        <RecordingPill
          state={{ kind: "transcribing", micStopped: view.micStopped, offline: view.offline }}
          onStop={() => undefined}
        />
      ) : (
        <RecordingPill
          state={{
            kind: "recording",
            title: view.title ?? defaultMeetingTitle(new Date(view.startedAt)),
            elapsedMs: now - view.startedAt,
            noCallAudio: view.noCallAudio,
            offline: view.offline,
            callAudioError: view.callAudioError,
          }}
          onStop={() => void stopCapture()}
          onShareTab={view.canShareTab ? () => void shareTabAudio() : undefined}
          systemAudio={systemAudioSupported()}
        />
      )}
    </div>
  );
}
