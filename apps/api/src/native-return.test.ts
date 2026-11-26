import { describe, expect, it } from "vitest";
import { connectReturnUrl, nativeReturnRoutes } from "./native-return.js";

describe("native connection return", () => {
  it("sends the browser to the app with a fixed address, whatever the query says", async () => {
    const app = nativeReturnRoutes();
    const res = await app.request(
      "/api/v1/connections/return?status=success&next=https://evil.test",
    );
    expect(res.status).toBe(302);
    expect(res.headers.get("location")).toBe("rakazo://integrations/connected");
  });

  it("keeps the web return page unless the caller is the iOS app", () => {
    expect(connectReturnUrl("https://a.test", undefined)).toBe(
      "https://a.test/integrations/connected",
    );
    expect(connectReturnUrl("https://a.test", "ios")).toBe(
      "https://a.test/api/v1/connections/return",
    );
  });
});
