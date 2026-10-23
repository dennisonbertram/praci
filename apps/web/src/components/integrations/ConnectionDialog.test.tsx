// @vitest-environment jsdom

import type { ReactNode } from "react";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { expect, it, vi } from "vitest";
import { ConnectionDialog } from "./ConnectionDialog";

vi.mock("@lingui/react/macro", () => ({
  Trans: ({ children }: { children: ReactNode }) => children,
}));

it("labels each field with visible text that stays after typing", async () => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  const host = document.createElement("div");
  document.body.append(host);
  await act(async () =>
    createRoot(host).render(
      <ConnectionDialog
        title="Connect Kraken"
        name="Kraken"
        logo={null}
        fields={[
          { id: "key", label: "API key" },
          { id: "secret", label: "Private key", type: "password" },
        ]}
        submitLabel="Connect"
        onSubmit={async () => {}}
        onClose={() => {}}
      />,
    ),
  );
  for (const name of ["API key", "Private key"]) {
    const label = [...document.querySelectorAll("label")].find((l) => l.textContent === name);
    const input = document.getElementById(label?.htmlFor ?? "");
    expect(input).not.toBeNull();
    expect(input?.getAttribute("placeholder")).toBeNull();
  }
});
