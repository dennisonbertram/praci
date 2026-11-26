// Test-only page for html-bridge.spec.ts: renders the real SandboxedHtmlViewer the way an agent page does,
// and records every message the app window receives so the test can assert what a page could send it.
import { createRoot } from "react-dom/client";
import { SandboxedHtmlViewer } from "../../src/components/SandboxedHtmlViewer";

type Harness = {
  received: { type: unknown; fromShell: boolean }[];
  show: (html: string, data?: Record<string, unknown>) => void;
};
declare global {
  interface Window {
    harness: Harness;
  }
}

const root = createRoot(document.getElementById("root") as HTMLElement);
const received: Harness["received"] = [];
window.addEventListener("message", (event) => {
  const frame = document.querySelector("iframe");
  received.push({
    type: (event.data as { type?: unknown } | null)?.type,
    fromShell: event.source === frame?.contentWindow,
  });
});
window.harness = {
  received,
  show: (html, data) =>
    root.render(<SandboxedHtmlViewer title="Agent page" html={html} data={data} />),
};
