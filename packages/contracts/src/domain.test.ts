import { describe, expect, it } from "vitest";
import { type ConnectionCatalogItem, preferNativeGmail } from "./domain.js";

const item = (connectorId: string, slug: string): ConnectionCatalogItem => ({
  connectorId,
  slug,
  name: slug,
  logo: null,
  connected: false,
  noAuth: false,
});
const google = item("google", "gmail");
const composio = item("composio", "gmail");
const pipedream = item("pipedream", "gmail");
const slack = item("composio", "slack");

describe("preferNativeGmail", () => {
  it("shows only the Google Gmail entry when native Google is configured and allowed", () => {
    expect(preferNativeGmail([composio, slack, google, pipedream], { nativeGoogle: true })).toEqual(
      [slack, google],
    );
  });

  it("keeps the managed Gmail entry when Google is not configured", () => {
    expect(preferNativeGmail([composio, slack], { nativeGoogle: true })).toEqual([composio, slack]);
  });

  it("hides the Google entry and keeps the managed one where native Google is unavailable", () => {
    expect(preferNativeGmail([composio, google, slack], { nativeGoogle: false })).toEqual([
      composio,
      slack,
    ]);
  });

  it("does not drop a managed non-Gmail entry whose slug merely contains gmail", () => {
    const other = item("composio", "gmail-labels");
    expect(preferNativeGmail([google, other], { nativeGoogle: true })).toEqual([google, other]);
  });
});
