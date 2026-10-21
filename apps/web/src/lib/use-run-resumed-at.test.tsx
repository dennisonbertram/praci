// @vitest-environment jsdom
import { act } from "react";
import { createRoot } from "react-dom/client";
import { expect, it } from "vitest";
import { useRunResumedAt } from "./use-run-resumed-at";

it("reports a resume time only after a waiting run starts working again", () => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  let resumedAt: number | undefined;
  function Probe({ status }: { status: string }) {
    resumedAt = useRunResumedAt([{ id: "r1", status }])("r1");
    return null;
  }
  const root = createRoot(document.createElement("div"));
  const show = (status: string) => act(() => root.render(<Probe status={status} />));
  show("running");
  expect(resumedAt).toBeUndefined();
  show("waiting_input");
  expect(resumedAt).toBeUndefined();
  const before = Date.now();
  show("running");
  expect(resumedAt).toBeGreaterThanOrEqual(before);
  act(() => root.unmount());
});
