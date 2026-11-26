import { describe, expect, it } from "vitest";
import { appRouteFor } from "./app-link";

describe("appRouteFor", () => {
  it("routes a page, a Data room file and an artifact", () => {
    expect(appRouteFor("/app/pages/b1/p1")).toEqual({
      pathname: "/agent-page",
      params: { botId: "b1", pageId: "p1" },
    });
    expect(appRouteFor("/app/data-room?item=i%201")).toEqual({
      pathname: "/data-room-item",
      params: { itemId: "i 1" },
    });
    expect(appRouteFor("/app/artifacts/a1")).toEqual({
      pathname: "/artifact",
      params: { artifactId: "a1" },
    });
  });

  it("has no screen for anything else", () => {
    for (const href of [
      "/app/finance",
      "/app/pages/b1",
      "/app/pages/b1/p1/extra",
      "/app/data-room",
      "//evil.test/app/pages/b/p",
      "https://evil.test/app/pages/b/p",
      "javascript:alert(1)",
      "/app/pages/%E0%A4%A/p",
    ]) {
      expect(appRouteFor(href)).toBeNull();
    }
  });
});
