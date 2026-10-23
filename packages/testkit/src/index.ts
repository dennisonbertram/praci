export { DestinationEmulator, McpEmulator } from "@rakazo/adapters";
export * from "./company-fixture.js";
export { FakeMeetingSource } from "./fake-meeting-source.js";

export function sessionCookieHeader(response: Response) {
  const cookies = response.headers.getSetCookie?.() ?? [];
  if (cookies.length) return cookies.map((cookie) => cookie.split(";")[0]).join("; ");
  return response.headers.get("set-cookie")?.split(",")[0]?.split(";")[0] ?? "";
}
