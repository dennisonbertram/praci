import { t } from "@lingui/core/macro";
import { enqueueNotificationToast } from "@rakazo/ui-web";
import { clearTourStep } from "../components/tour/TourPopover";
import { clearAgentAppCache } from "./agent-app";
import { authClient } from "./auth";
import { clearCaptureOnSignOut } from "./meeting-capture/controller";
import { clearSpaceSelection } from "./rpc";

/**
 * Ends the session, then leaves. Local state is cleared only after the server confirms, so a
 * failed sign-out (offline, server error) leaves the user where they are, still signed in, with a
 * toast instead of a silent redirect back into the app.
 */
export async function signOutAndLeave(
  navigate: (to: string) => void,
  userId?: string | null,
): Promise<void> {
  try {
    const result = await authClient.signOut();
    if (result.error) throw new Error(result.error.statusText);
  } catch {
    enqueueNotificationToast({ id: "sign-out-failed", title: t`Could not sign out. Try again.` });
    return;
  }
  clearTourStep(userId);
  clearAgentAppCache();
  clearSpaceSelection();
  await clearCaptureOnSignOut(userId);
  navigate("/");
}
