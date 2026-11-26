import { expect, it } from "vitest";
import { recordHref } from "./links";

it("opens each record where it lives, with that record open", () => {
  expect(recordHref("stakeholder", "sh-1")).toBe("/app/cap-table/stakeholders/sh-1");
  expect(recordHref("certificate", "c-1")).toBe("/app/cap-table/securities?certificate=c-1");
  expect(recordHref("convertible", "s-1")).toBe(
    "/app/cap-table/securities/convertibles?convertible=s-1",
  );
  expect(recordHref("option_grant", "g-1")).toBe("/app/cap-table/plans/grants?grant=g-1");
  expect(recordHref("share_class", "sc-1")).toBe("/app/cap-table/share-classes");
  expect(recordHref("plan", "p-1")).toBe("/app/cap-table/plans/equity-plans");
});
