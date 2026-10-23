// @vitest-environment jsdom

import { act } from "react";
import { createRoot } from "react-dom/client";
import { expect, it, vi } from "vitest";
import { AppLogo } from "./AppLogo";

async function render(logo: string | null, name = "gmail") {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);
  await act(async () => root.render(<AppLogo name={name} logo={logo} />));
  return { container, root };
}

it("shows the catalog logo", async () => {
  const { container } = await render("https://logos.example.test/gmail.svg", "Acme");
  expect(container.querySelector("img")?.getAttribute("src")).toBe(
    "https://logos.example.test/gmail.svg",
  );
});

it("shows the bundled mark of an app with no logo, and the initial for any other app", async () => {
  const bundled = await render(null, "Linear");
  expect(bundled.container.querySelector("img")?.getAttribute("src")).toBe(
    "/logos/simple/linear.svg",
  );
  const unknown = await render(null, "Some app");
  expect(unknown.container.querySelector("img")).toBeNull();
  expect(unknown.container.textContent).toBe("S");
  const nameless = await render(null, "+");
  expect(nameless.container.querySelector("svg")).not.toBeNull();
  expect(nameless.container.textContent).toBe("");
});

it("falls back to the initial when the image fails to load", async () => {
  const { container } = await render("https://logos.example.test/broken.svg", "Gmail");
  const img = container.querySelector("img");
  await act(async () => {
    img?.dispatchEvent(new Event("error"));
  });
  expect(container.querySelector("img")).toBeNull();
  expect(container.textContent).toBe("G");
  expect(container.querySelector("[data-fallback]")).not.toBeNull();
});

it("serves bundled marks locally on the same white tile, whatever logo URL the source gives", async () => {
  const { container } = await render("https://cdn.simpleicons.org/brex", "Brex");
  const img = container.querySelector("img");
  expect(img?.getAttribute("src")).toBe("/logos/simple/brex.svg");
  const tile = container.querySelector("[data-testid=app-logo]")?.className;
  expect(tile).toContain("bg-white");
  const other = await render("https://logos.example.test/gmail.svg", "Gmail");
  expect(other.container.querySelector("img")?.getAttribute("src")).toBe("/logos/simple/gmail.svg");
  expect(other.container.querySelector("[data-testid=app-logo]")?.className).toBe(
    (await render("https://cdn.simpleicons.org/gmail", "Gmail")).container.querySelector(
      "[data-testid=app-logo]",
    )?.className,
  );
});

it("never requests the Simple Icons CDN, even for marks that are not bundled", async () => {
  const { container } = await render("https://cdn.simpleicons.org/someunknownapp", "Some app");
  expect(container.querySelector("img")).toBeNull();
  expect(container.textContent).toBe("S");
});

it("gives a known app without a mark a glyph, never an unrelated letter", async () => {
  for (const name of ["Carta", "Treg", "Devin", "Granola", "Wispr Flow", "iMessage on your Mac"]) {
    const { container } = await render(null, name);
    expect(container.querySelector("svg")).not.toBeNull();
    expect(container.textContent).toBe("");
  }
});

it("puts a glyph for an app with no mark (Carta) on the same white tile", async () => {
  const { container } = await render(null, "Carta");
  expect(container.querySelector("img")).toBeNull();
  expect(container.querySelector("[data-testid=app-logo]")?.className).toContain("bg-white");
});
