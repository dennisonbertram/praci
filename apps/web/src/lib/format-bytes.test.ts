import { i18n } from "@lingui/core";
import { beforeAll, describe, expect, it } from "vitest";
import { formatBytes } from "./format-bytes";

describe("formatBytes", () => {
  beforeAll(() => i18n.loadAndActivate({ locale: "en", messages: {} }));

  it("uses binary B, KB and MB", () => {
    expect([formatBytes(512), formatBytes(12_345), formatBytes(3 * 1024 * 1024)]).toEqual([
      "512 B",
      "12.1 KB",
      "3.0 MB",
    ]);
  });
});
