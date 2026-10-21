// @vitest-environment jsdom

import { act } from "react";
import { createRoot } from "react-dom/client";
import { expect, it, vi } from "vitest";

vi.mock("@lingui/react/macro", () => ({
  useLingui: () => ({
    t: (parts: TemplateStringsArray, ...values: unknown[]) =>
      parts.reduce((text, part, i) => `${text}${part}${i < values.length ? values[i] : ""}`, ""),
  }),
}));
vi.mock("../sidebar-glance", () => ({ StatusMark: () => null }));

import { FolderHeader } from "./FolderHeader";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

it("keeps the rename open with an error when another folder has the name", async () => {
  const onRename = vi.fn();
  const container = document.createElement("div");
  document.body.append(container);
  await act(async () =>
    createRoot(container).render(
      <FolderHeader
        id="f1"
        name="Untitled folder"
        count={0}
        collapsed={false}
        editing
        takenNames={["Apps"]}
        onToggle={() => undefined}
        onStartRename={() => undefined}
        onRename={onRename}
        onCancelRename={() => undefined}
        onDelete={() => undefined}
      />,
    ),
  );
  const input = container.querySelector("input")!;
  await act(async () => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(input, "Apps");
    input.dispatchEvent(new Event("input", { bubbles: true }));
  });
  await act(async () => {
    input.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
  });
  expect(onRename).not.toHaveBeenCalled();
  expect(container.querySelector("[role=alert]")?.textContent).toBe(
    "A folder with that name already exists",
  );
});
