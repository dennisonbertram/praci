import { describe, expect, it } from "vitest";
import { buildConnectLink, parseConnectLink } from "./payload.mjs";

describe("connect link payload", () => {
  it.each(["https://my-mac.example.ts.net", "http://192.168.1.20:5173", "http://[fd00::1]:5173"])(
    "round-trips %s",
    (origin) => {
      expect(parseConnectLink(buildConnectLink(origin))).toBe(origin);
    },
  );

  it("accepts bare URLs and hosts", () => {
    expect(parseConnectLink("https://my-mac.example.ts.net")).toBe("https://my-mac.example.ts.net");
    expect(parseConnectLink("192.168.1.20:5173")).toBe("https://192.168.1.20:5173");
    expect(parseConnectLink("localhost:5173")).toBe("https://localhost:5173");
    expect(parseConnectLink("my-mac.example.ts.net:8443")).toBe(
      "https://my-mac.example.ts.net:8443",
    );
    expect(parseConnectLink("[fd00::1]:5173")).toBe("https://[fd00::1]:5173");
  });

  it("ignores unknown connect-link keys", () => {
    const encoded = encodeURIComponent("https://my-mac.example.ts.net");
    expect(parseConnectLink(`rakazo://connect?other=value&server=${encoded}`)).toBe(
      "https://my-mac.example.ts.net",
    );
  });

  it.each([
    "https://user:password@my-mac.example.ts.net",
    "https://@my-mac.example.ts.net",
    "https://:@my-mac.example.ts.net",
    "https://my-mac.example.ts.net/",
    "https://my-mac.example.ts.net/path",
    "https://my-mac.example.ts.net?query=value",
    "https://my-mac.example.ts.net#fragment",
  ])("rejects a non-origin URL: %s", (value) => {
    expect(() => buildConnectLink(value)).toThrow();
    expect(() => parseConnectLink(value)).toThrow();
  });

  it("rejects repeated server keys and malformed links", () => {
    const encoded = encodeURIComponent("https://my-mac.example.ts.net");
    expect(() => parseConnectLink(`rakazo://connect?server=${encoded}&server=${encoded}`)).toThrow(
      "Connect link must contain one server.",
    );
    expect(() => parseConnectLink(`rakazo://connect:8443?server=${encoded}`)).toThrow(
      "Enter a valid connect link.",
    );
    expect(() => parseConnectLink(`rakazo://@connect?server=${encoded}`)).toThrow(
      "Enter a valid connect link.",
    );
    const emptyUserInfo = encodeURIComponent("https://@my-mac.example.ts.net");
    expect(() => parseConnectLink(`rakazo://connect?server=${emptyUserInfo}`)).toThrow();
    expect(() => parseConnectLink("rakazo://sign-in")).toThrow();
    expect(() => parseConnectLink(" ")).toThrow();
  });
});
