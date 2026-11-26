import { readFileSync } from "node:fs";
import vm from "node:vm";
import { JSDOM } from "jsdom";
import { describe, expect, it } from "vitest";

/** The live page helper's isolated-world script, executed here rather than reimplemented. */
function installPageHelper(url: string, html: string) {
  const source = readFileSync(
    new URL("../../../infra/sandboxes/computer/rakazo-page-browser", import.meta.url),
    "utf8",
  );
  const match = source.match(/EVAL_HELPERS = r"""\n([\s\S]*?)\n"""/);
  if (!match?.[1]) throw new Error("page browser helper script was not found");
  const dom = new JSDOM(
    `<!doctype html><html><head><title>Sign in</title></head><body>${html}</body></html>`,
    {
      url,
      pretendToBeVisual: true,
      runScripts: "outside-only",
    },
  );
  const domWindow = dom.window;
  const elementPrototype = domWindow.Element.prototype as unknown as {
    getBoundingClientRect: () => unknown;
  };
  elementPrototype.getBoundingClientRect = () => ({
    width: 10,
    height: 10,
    top: 0,
    left: 0,
    right: 10,
    bottom: 10,
    x: 0,
    y: 0,
    toJSON() {
      return {};
    },
  });
  vm.runInContext(match[1], dom.getInternalVMContext());
  const browser = (
    domWindow as unknown as {
      __rakazoPageBrowser: {
        snapshot: () => { elements: Array<{ ref: string; name: string; value?: string }> };
        fill: (ref: string, value: string, origin?: string, field?: string) => { url: string };
      };
    }
  ).__rakazoPageBrowser;
  return { domWindow, browser };
}

function fieldValue(window: JSDOM["window"], label: string): string {
  const field = window.document.querySelector(`[aria-label="${label}"]`) as {
    value?: string;
  } | null;
  return field?.value ?? "";
}

function refFor(name: string, elements: Array<{ ref: string; name: string }>) {
  const match = elements.find((element) => element.name.includes(name));
  if (!match) throw new Error(`missing field ${name}`);
  return match.ref;
}

describe("live page helper saved-login fill", () => {
  const html = `
    <input aria-label="Email" />
    <input aria-label="Password" type="password" />
    <input aria-label="Phone" type="tel" />
    <textarea aria-label="Username"></textarea>
    <input aria-label="Query" type="search" />
    <input aria-label="Website" type="url" />
    <input aria-label="Pin" type="number" />
  `;

  const origin = "https://login.example.test";

  it("types a username only into text, email, and tel inputs on the saved HTTPS origin", () => {
    const { domWindow, browser } = installPageHelper(`${origin}/signin`, html);
    const snap = browser.snapshot();
    browser.fill(refFor("Email", snap.elements), "fake-user", origin, "username");
    browser.fill(refFor("Phone", snap.elements), "555", origin, "username");
    expect(fieldValue(domWindow, "Email")).toBe("fake-user");
    expect(fieldValue(domWindow, "Phone")).toBe("555");
    for (const name of ["Password", "Username", "Query", "Website", "Pin"]) {
      expect(() =>
        browser.fill(refFor(name, snap.elements), "fake-name", origin, "username"),
      ).toThrow(/text, email, or telephone/);
    }
    expect(fieldValue(domWindow, "Password")).toBe("");
  });

  it("types a password only into a password field, also when the field is not named", () => {
    const { domWindow, browser } = installPageHelper(`${origin}/signin`, html);
    const snap = browser.snapshot();
    for (const name of ["Email", "Phone", "Username", "Query", "Website", "Pin"]) {
      for (const field of ["password", undefined]) {
        expect(() =>
          browser.fill(refFor(name, snap.elements), "fake-password", origin, field),
        ).toThrow(/password field/);
      }
    }
    expect(domWindow.document.body.innerHTML).not.toContain("fake-password");
    expect(JSON.stringify(browser.snapshot())).not.toContain("fake-password");
    browser.fill(
      refFor("Password", browser.snapshot().elements),
      "fake-password",
      origin,
      "password",
    );
    expect(fieldValue(domWindow, "Password")).toBe("fake-password");
    expect(JSON.stringify(browser.snapshot())).not.toContain("fake-password");
  });

  function passwordField(domWindow: JSDOM["window"]) {
    return domWindow.document.querySelector('[aria-label="Password"]') as HTMLInputElement;
  }

  it("preserves a revealed password while keeping its value out of snapshots", async () => {
    const { domWindow, browser } = installPageHelper(`${origin}/signin`, html);
    const field = passwordField(domWindow);
    field.addEventListener("input", () => (field.type = "text"), { once: true });
    const ref = refFor("Password", browser.snapshot().elements);
    browser.fill(ref, "fake-password", origin, "password");
    await Promise.resolve();
    expect(field.type).toBe("text");
    expect(field.value).toBe("fake-password");
    // Snapshots still never report it.
    expect(JSON.stringify(browser.snapshot())).not.toContain("fake-password");
  });

  it("refuses a password field that the page turns into text when it is focused", () => {
    const { domWindow, browser } = installPageHelper(`${origin}/signin`, html);
    const field = passwordField(domWindow);
    field.addEventListener("focus", () => (field.type = "text"));
    const ref = refFor("Password", browser.snapshot().elements);
    expect(() => browser.fill(ref, "fake-password", origin, "password")).toThrow(/password field/);
    expect(field.value).toBe("");
  });

  it("leaves nothing of a login that the field only partly accepts", () => {
    const { domWindow, browser } = installPageHelper(
      `${origin}/signin`,
      '<input aria-label="Email" type="email" />',
    );
    const ref = refFor("Email", browser.snapshot().elements);
    // Email fields trim surrounding spaces, so the value read back differs from the one set.
    // Settled like the other refusals: no desktop fallback, which can't type a saved login.
    expect(() => browser.fill(ref, " fake-user ", origin, "username")).toThrow(
      /^Refused: This field didn't accept the saved login, so it was cleared\.$/,
    );
    expect(fieldValue(domWindow, "Email")).toBe("");
  });

  it("refuses a private-LAN HTTP origin in the same fill, even when the page matches", () => {
    const origin = "http://192.168.2.10:8080";
    const { domWindow, browser } = installPageHelper(`${origin}/signin`, html);
    const email = refFor("Email", browser.snapshot().elements);
    expect(() => browser.fill(email, "fake-user", origin)).toThrow(/HTTPS/);
    expect(fieldValue(domWindow, "Email")).toBe("");
  });
});
