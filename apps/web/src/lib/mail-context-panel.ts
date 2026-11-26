import { useEffect, useState } from "react";
import { authClient } from "./auth";

const KEY_PREFIX = "rakazo:mail-context-open:";

/** True on a screen wide enough to hold the panel beside the mail; a phone starts with it closed. */
const wideScreen = () => {
  try {
    return window.matchMedia("(min-width: 768px)").matches;
  } catch {
    return true;
  }
};

export function readContextPanelOpen(userId: string | null | undefined): boolean {
  // A phone shows the panel as a sheet over the mail, so it never opens by itself.
  if (!wideScreen()) return false;
  try {
    const stored = userId ? window.localStorage.getItem(KEY_PREFIX + userId) : null;
    if (stored === "1" || stored === "0") return stored === "1";
  } catch {
    // Blocked storage: use the default.
  }
  return true;
}

export function writeContextPanelOpen(userId: string | null | undefined, open: boolean): void {
  // The remembered choice is the desktop one; a phone's sheet does not change it.
  if (!userId || !wideScreen()) return;
  try {
    window.localStorage.setItem(KEY_PREFIX + userId, open ? "1" : "0");
  } catch {
    // Private mode: the choice lasts until the page closes.
  }
}

/** Whether the mail Context panel is open, remembered per signed-in user in this browser. */
export function useContextPanelOpen(resetKey?: unknown): [boolean, (open: boolean) => void] {
  const userId = authClient.useSession().data?.user.id;
  const [chosen, setChosen] = useState<boolean | null>(null);
  // On a phone the sheet covers the mail, so each new mail starts without it.
  // biome-ignore lint/correctness/useExhaustiveDependencies: runs when the key changes
  useEffect(() => {
    if (!wideScreen()) setChosen(false);
  }, [resetKey]);
  return [
    chosen ?? readContextPanelOpen(userId),
    (open) => {
      setChosen(open);
      writeContextPanelOpen(userId, open);
    },
  ];
}
