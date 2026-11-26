import { useLingui } from "@lingui/react/macro";
import { useEffect, useState } from "react";
import { desktopBridge, windowChromeKind } from "../lib/desktop";

export function WindowChrome() {
  const { t } = useLingui();
  const desktop = desktopBridge();
  const kind = windowChromeKind(desktop);
  const [maximized, setMaximized] = useState(false);
  useEffect(() => {
    if (kind !== "controls" || !desktop) return;
    let live = true;
    const sync = () => {
      void desktop.window.state().then((state) => {
        if (live) setMaximized(state.maximized);
      });
    };
    sync();
    window.addEventListener("resize", sync);
    return () => {
      live = false;
      window.removeEventListener("resize", sync);
    };
  }, [desktop, kind]);
  if (kind === "spacer") {
    return <div className="h-3 w-[72px]" aria-hidden="true" />;
  }
  if (kind === "darwin") {
    return <div className="app-drag h-3 w-[72px]" aria-hidden="true" />;
  }
  return (
    <div className="app-drag flex gap-[7px]">
      <button
        type="button"
        className="app-no-drag h-3 w-3 rounded-full bg-[#FF5F57]"
        aria-label={t`Close`}
        onClick={() => void desktop?.window.close()}
      />
      <button
        type="button"
        className="app-no-drag h-3 w-3 rounded-full bg-[#FEBC2E]"
        aria-label={t`Minimize`}
        onClick={() => void desktop?.window.minimize()}
      />
      <button
        type="button"
        className="app-no-drag h-3 w-3 rounded-full bg-[#28C840]"
        aria-label={maximized ? t`Restore` : t`Maximize`}
        onClick={() => {
          const win = desktop?.window;
          if (!win) return;
          void win
            .toggleMaximize()
            .then(() => win.state())
            .then((state) => setMaximized(state.maximized));
        }}
      />
    </div>
  );
}
