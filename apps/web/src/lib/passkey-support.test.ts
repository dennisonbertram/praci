import { describe, expect, it } from "vitest";
import { passkeyCancelled, passkeysAvailable } from "./passkey-support";

describe("passkeysAvailable", () => {
  const ok = { hostname: "localhost", webauthn: true };
  it("shows on a domain name with WebAuthn and server support", () => {
    expect(passkeysAvailable(true, ok)).toBe(true);
    expect(passkeysAvailable(true, { ...ok, hostname: "app.example.com" })).toBe(true);
  });
  it("hides without server support, including older servers", () => {
    expect(passkeysAvailable(false, ok)).toBe(false);
    expect(passkeysAvailable(undefined, ok)).toBe(false);
  });
  it("hides without WebAuthn", () => {
    expect(passkeysAvailable(true, { ...ok, webauthn: false })).toBe(false);
  });
  it("hides on IP-address hosts", () => {
    for (const hostname of ["127.0.0.1", "192.168.1.5", "[::1]", "::1"]) {
      expect(passkeysAvailable(true, { ...ok, hostname })).toBe(false);
    }
  });
});

describe("passkeyCancelled", () => {
  it("treats a dismissed prompt as cancelled and a server error as a failure", () => {
    expect(passkeyCancelled({ code: "AUTH_CANCELLED" })).toBe(true);
    expect(passkeyCancelled({ code: "ERROR_CEREMONY_ABORTED" })).toBe(true);
    expect(passkeyCancelled({ code: "PASSKEY_NOT_FOUND" })).toBe(false);
    expect(passkeyCancelled(null)).toBe(false);
  });
});
