// @vitest-environment jsdom

import type { DataRoomApiItem } from "@rakazo/contracts";
import type { ReactNode } from "react";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

vi.mock("@lingui/core/macro", () => ({ t: (parts: TemplateStringsArray) => parts.join("") }));
vi.mock("@lingui/react/macro", () => ({
  Trans: ({ children }: { children: ReactNode }) => children,
}));
const imageUrl = vi.hoisted(() => vi.fn());
const openItem = vi.hoisted(() => vi.fn());
const saveItem = vi.hoisted(() => vi.fn());
vi.mock("../../lib/data-room", async (original) => ({
  ...(await original<typeof import("../../lib/data-room")>()),
  dataRoomFileUrl: imageUrl,
  openDataRoomItem: openItem,
  saveDataRoomItem: saveItem,
}));

import { setHideAmounts } from "../../lib/hide-amounts-preference";
import { Preview } from "./Preview";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const receipt = {
  id: "r1",
  name: "receipt.png",
  mimeType: "image/png",
  size: 100,
  folderId: null,
  source: "upload",
  sourceUrl: null,
  status: "ready",
  error: null,
  notIndexed: false,
  facets: {
    docType: null,
    docDate: null,
    parties: [],
    amountCents: null,
    currency: null,
    tags: [],
    summary: null,
  },
  createdAt: "2026-10-01T00:00:00.000Z",
  hasThumbnail: false,
  previewText: null,
} as DataRoomApiItem;

let container: HTMLDivElement;
let root: ReturnType<typeof createRoot>;
beforeEach(() => {
  imageUrl.mockResolvedValue("blob:receipt");
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
});
afterEach(() => {
  act(() => root.unmount());
  container.remove();
  setHideAmounts(false);
  vi.clearAllMocks();
});

const icon = (label: string) =>
  container.querySelector(`button[aria-label="${label}"]`) as HTMLButtonElement;

const render = () =>
  act(async () => {
    root.render(
      <Preview item={receipt} folderPath="" onAction={() => undefined} onClose={() => undefined} />,
    );
  });

it("shows the picture of an image item", async () => {
  await render();
  expect(container.querySelector("img")?.getAttribute("src")).toBe("blob:receipt");
});

it("replaces the picture with a note, and never fetches it, while amounts are hidden", async () => {
  setHideAmounts(true);
  await render();
  expect(container.querySelector("img")).toBeNull();
  expect(imageUrl).not.toHaveBeenCalled();
  expect(container.textContent).toContain("Image hidden while amounts are hidden");
  await act(async () => setHideAmounts(false));
  expect(container.querySelector("img")?.getAttribute("src")).toBe("blob:receipt");
});

it("keeps a PDF readable and openable while amounts are hidden, but not an image", async () => {
  const pdf = { ...receipt, mimeType: "application/pdf" } as DataRoomApiItem;
  const show = (item: DataRoomApiItem) =>
    act(async () => {
      root.render(
        <Preview item={item} folderPath="" onAction={() => undefined} onClose={() => undefined} />,
      );
    });
  const openButton = () =>
    container.querySelector<HTMLButtonElement>('button[aria-label="Open in new tab"]');
  await act(async () => setHideAmounts(true));
  await show(pdf);
  expect(openButton()?.disabled).toBe(false);
  expect(container.textContent).not.toContain("hidden while amounts are hidden");
  await show(receipt);
  expect(openButton()?.disabled).toBe(true);
  expect(container.textContent).toContain("Image hidden while amounts are hidden");
});

it("shows no file frame for a failed file, with Try again under the heading and Delete below", async () => {
  const onAction = vi.fn();
  const failed = { ...receipt, mimeType: "application/pdf", status: "failed", error: "Not a PDF" };
  await act(async () => {
    root.render(
      <Preview item={failed} folderPath="" onAction={onAction} onClose={() => undefined} />,
    );
  });
  expect(container.querySelector("iframe, object, embed")).toBeNull();
  const retry = Array.from(container.querySelectorAll("button")).find(
    (button) => button.textContent === "Try again",
  );
  expect(retry).toBeDefined();
  // It follows the failure message, ahead of the details.
  expect(retry?.previousElementSibling?.textContent).toBe("Not a PDF");
  act(() => retry?.click());
  expect(onAction).toHaveBeenCalledWith("retry", failed);
  const last = Array.from(container.querySelectorAll("aside > div:last-child > button"));
  expect(last.map((button) => button.textContent)).toEqual(["Delete"]);
});

it("keeps showing the summary while a renamed file is re-indexed", async () => {
  const indexing = {
    ...receipt,
    mimeType: "application/pdf",
    status: "indexing",
    facets: { ...receipt.facets, docType: "Roadmap", summary: "Two quarters of plans." },
  };
  await act(async () => {
    root.render(
      <Preview
        item={indexing}
        folderPath=""
        onAction={() => undefined}
        onClose={() => undefined}
      />,
    );
  });
  expect(container.textContent).toContain("Two quarters of plans.");
  expect(container.textContent).not.toContain("Reading");
});

it("opens a readable PDF in the browser, and says an untagged file is not tagged yet", async () => {
  openItem.mockResolvedValue(undefined);
  const pdf = { ...receipt, name: "nda.pdf", mimeType: "application/pdf" };
  await act(async () => {
    root.render(
      <Preview item={pdf} folderPath="" onAction={() => undefined} onClose={() => undefined} />,
    );
  });
  expect(container.textContent).toContain("Not tagged yet");
  act(() => icon("Open in new tab").click());
  expect(openItem).toHaveBeenCalledWith(pdf);
});

it("says a file too large to read is not searchable inside, instead of not tagged yet", async () => {
  await act(async () => {
    root.render(
      <Preview
        item={{ ...receipt, notIndexed: true }}
        folderPath=""
        onAction={() => undefined}
        onClose={() => undefined}
      />,
    );
  });
  expect(container.textContent).toContain("Too large to search inside");
  expect(container.textContent).not.toContain("Not tagged yet");

  // A file still being read shows neither line.
  await act(async () => {
    root.render(
      <Preview
        item={{ ...receipt, notIndexed: true, status: "extracting" }}
        folderPath=""
        onAction={() => undefined}
        onClose={() => undefined}
      />,
    );
  });
  expect(container.textContent).not.toContain("Too large to search inside");
});

it("disables Open for a file the browser cannot show, and Full screen opens a spreadsheet", async () => {
  const sheet = {
    ...receipt,
    name: "budget.csv",
    mimeType: "text/csv",
    facets: { ...receipt.facets, docType: "spreadsheet" },
  };
  await act(async () => {
    root.render(
      <Preview item={sheet} folderPath="" onAction={() => undefined} onClose={() => undefined} />,
    );
  });
  expect(icon("Open in new tab").disabled).toBe(true);
  expect(icon("Full screen")).not.toBeNull();
  expect(container.textContent).not.toContain("Not tagged yet");
});

it("says a file still being read can be left to finish", async () => {
  await act(async () => {
    root.render(
      <Preview
        item={{ ...receipt, status: "extracting" }}
        folderPath=""
        onAction={() => undefined}
        onClose={() => undefined}
      />,
    );
  });
  expect(container.textContent).toContain("You can keep working while it finishes.");
});

const show = (item: DataRoomApiItem) =>
  act(async () => {
    root.render(
      <Preview item={item} folderPath="" onAction={() => undefined} onClose={() => undefined} />,
    );
  });

it("frames a PDF with the browser viewer, and keeps it while amounts are hidden", async () => {
  const pdf = { ...receipt, name: "nda.pdf", mimeType: "application/pdf" };
  await show(pdf);
  expect(imageUrl).toHaveBeenCalledWith({ id: "r1", mimeType: "application/pdf" });
  expect(container.querySelector("iframe")?.getAttribute("src")).toBe("blob:receipt#toolbar=0");
  await act(async () => setHideAmounts(true));
  expect(container.querySelector("iframe")).not.toBeNull();
});

it("shows a skeleton while loading, and the file icon for other types or a failed read", async () => {
  imageUrl.mockReturnValue(new Promise(() => undefined));
  await show(receipt);
  expect(container.querySelector("[data-testid=preview-skeleton]")).not.toBeNull();
  imageUrl.mockRejectedValue(new Error("nope"));
  await show({ ...receipt, id: "r2" });
  expect(container.querySelector("img, iframe")).toBeNull();
  expect(container.querySelector("[data-testid=preview-skeleton]")).toBeNull();
  imageUrl.mockClear();
  await show({ ...receipt, id: "r3", mimeType: "text/csv" });
  expect(imageUrl).not.toHaveBeenCalled();
  expect(container.querySelector("img, iframe, [data-testid=preview-skeleton]")).toBeNull();
});

it("truncates a long party at the end and shows it whole on hover", async () => {
  const name = "The Guardian Life Insurance Company of America";
  await show({ ...receipt, facets: { ...receipt.facets, parties: [name] } });
  const chip = container.querySelector(`[title="${name}"]`);
  expect(chip?.querySelector(".truncate")?.textContent).toBe(name);
});

it("resizes from its left edge by keyboard and drag, within limits, and remembers the width", async () => {
  localStorage.clear();
  window.innerWidth = 1000;
  await show(receipt);
  const handle = () => container.querySelector("hr[aria-label='Resize panel']") as HTMLElement;
  const width = () => (container.querySelector("aside") as HTMLElement).style.width;
  expect(width()).toBe("360px");
  const key = (name: string) =>
    act(async () => {
      handle().dispatchEvent(new KeyboardEvent("keydown", { key: name, bubbles: true }));
    });
  await key("ArrowLeft");
  expect(width()).toBe("392px");
  await key("Home");
  expect(width()).toBe("320px");
  await key("End");
  expect(width()).toBe("600px");
  expect(localStorage.getItem("rakazo:data-room-preview-width")).toBe("600");
  // Dragging left grows the pane.
  handle().setPointerCapture = () => undefined;
  await key("Home");
  await act(async () => {
    handle().dispatchEvent(new MouseEvent("pointerdown", { clientX: 700, bubbles: true }));
  });
  await act(async () => {
    handle().dispatchEvent(new MouseEvent("pointermove", { clientX: 600, bubbles: true }));
  });
  expect(width()).toBe("420px");
  // A fresh mount reads the saved width.
  await act(async () => root.unmount());
  root = createRoot(container);
  await show(receipt);
  expect(width()).toBe("420px");
});

it("offers Send to agent in the preview's More actions menu when there are agents", async () => {
  await act(async () => {
    root.render(
      <Preview
        item={receipt}
        folderPath=""
        onAction={() => undefined}
        onClose={() => undefined}
        agents={[{ id: "bot_ada", name: "Ada", color: "#6366f1" }]}
        onSendToAgent={() => undefined}
      />,
    );
  });
  const button = container.querySelector('button[aria-label^="More actions for"]') as HTMLElement;
  await act(async () => button.click());
  await act(() => new Promise((resolve) => setTimeout(resolve, 0)));
  const names = Array.from(document.body.querySelectorAll('[role="menuitem"]')).map((e) =>
    e.textContent?.trim(),
  );
  expect(names).toEqual(["Send to agent", "Share with investors", "Move", "Rename", "Delete"]);
});

it("downloads from the header icon", async () => {
  saveItem.mockResolvedValue(undefined);
  await render();
  act(() => icon("Download").click());
  expect(saveItem).toHaveBeenCalledWith(receipt);
});

it("opens the picture in a full-screen dialog without fetching it again, and Escape closes it", async () => {
  await render();
  expect(imageUrl).toHaveBeenCalledTimes(1);
  await act(async () => icon("Full screen").click());
  const dialog = document.body.querySelector('[data-slot="dialog-content"]');
  expect(dialog?.querySelector("img")?.getAttribute("src")).toBe("blob:receipt");
  expect(dialog?.textContent).toContain("receipt.png");
  expect(imageUrl).toHaveBeenCalledTimes(1);
  await act(async () => {
    document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
  });
  expect(document.body.querySelector('[data-slot="dialog-content"]')).toBeNull();
});
