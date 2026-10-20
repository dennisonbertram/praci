import { describe, expect, it } from "vitest";
import { isPrivateServerUrl } from "./messaging-setup.js";

describe("isPrivateServerUrl", () => {
  it.each([
    "http://192.168.1.20:1234",
    "http://10.0.0.2",
    "http://172.20.0.1",
    "http://127.0.0.1:1234",
    "http://localhost:1234",
    "http://100.101.102.103:1234",
    "https://mac.tail1234.ts.net",
    "http://my-mac.local:1234",
    "http://my-mac:1234",
    "http://[::1]:1234",
  ])("treats %s as private", (url) => expect(isPrivateServerUrl(url)).toBe(true));

  it.each([
    "https://bb.example.com",
    "http://203.0.113.7:1234",
    "https://abc.ngrok-free.app",
    "http://172.32.0.1",
    "http://100.128.0.1",
  ])("treats %s as public", (url) => expect(isPrivateServerUrl(url)).toBe(false));
});
