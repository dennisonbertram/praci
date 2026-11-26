import type { RakazoDesktop, RakazoDesktopScanner, ScannerState } from "@rakazo/contracts";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, fn, userEvent, waitFor, within } from "storybook/test";
import { mockRpc } from "../lib/__mocks__/rpc";
import { items } from "../stories/fixtures/data-room";
import { ScannerPage } from "./Scanner";

function load(
  kind?: ScannerState["kind"],
  empty = false,
  platform = "linux",
  patch: Partial<ScannerState> = {},
) {
  const previous = window.rakazoDesktop;
  const listeners = new Set<(state: ScannerState) => void>();
  let state: ScannerState = {
    kind: kind ?? "ready",
    autoScan: true,
    folder: ["Scans"],
    ...(kind === "ready" || kind === "scanning" ? { device: "ScanSnap iX1600" } : {}),
    ...patch,
    ...(kind === "error"
      ? { error: "Paper jam. Clear the feeder and retry the whole batch." }
      : {}),
  };
  const update = (patch: Partial<ScannerState>) => {
    state = { ...state, ...patch };
    for (const listener of listeners) listener(state);
  };
  const scanner: RakazoDesktopScanner = {
    state: async () => state,
    onState: (listener) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    scan: async () => update({ kind: "scanning" }),
    cancel: async () => update({ kind: "ready" }),
    setAutoScan: async (autoScan) => update({ autoScan }),
    setFolder: fn(async (folder) => update({ folder })),
    setScope: async () => undefined,
    pending: async () => [],
    confirm: async () => ({ ok: true }),
    onDocument: () => () => undefined,
  };
  window.rakazoDesktop = kind ? ({ platform, scanner } as RakazoDesktop) : undefined;
  mockRpc({
    "dataRoom.folders": [
      { id: "scans", name: "Scans", parentId: null, createdAt: "2026-01-01T00:00:00Z" },
    ],
    "dataRoom.imports": [],
    "dataRoom.processing": { reading: 0, indexing: 0, tagging: 0, failed: 0, current: null },
    "dataRoom.facetValues": { types: ["Contract"], parties: [], sources: ["scan"], hasDates: true },
    "dataRoom.items.list": {
      items: empty
        ? []
        : items.slice(0, 2).map((item) => ({ ...item, source: "scan", folderId: "scans" })),
      nextCursor: null,
    },
  });
  return () => {
    window.rakazoDesktop = previous;
  };
}

const meta = {
  title: "Pages/Scanner",
  component: ScannerPage,
  parameters: { layout: "fullscreen", initialEntries: ["/app/scanner"] },
  decorators: [
    (Story) => (
      <div className="flex h-[640px]">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof ScannerPage>;
export default meta;
type Story = StoryObj<typeof meta>;

function markStoryPlayComplete(story: string) {
  document.documentElement.dataset.scannerPlayComplete = story;
}

export const Ready: Story = {
  beforeEach: () => load("ready"),
  play: async ({ canvasElement }) => {
    await waitFor(() =>
      expect(within(canvasElement).getByRole("status")).toHaveTextContent(
        "ScanSnap iX1600 · Scans when paper is loaded",
      ),
    );
    markStoryPlayComplete("Ready");
  },
};
export const Empty: Story = { beforeEach: () => load("ready", true) };
export const Scanning: Story = {
  beforeEach: () => load("scanning"),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await waitFor(() => expect(canvas.getByRole("status")).toHaveTextContent("Scanning…"));
    await expect(canvas.queryByText("Scanning pages…")).not.toBeInTheDocument();
    markStoryPlayComplete("Scanning");
  },
};
export const PaperJam: Story = { beforeEach: () => load("error") };
export const MissingSane: Story = {
  beforeEach: () => load("sane-missing", false, "darwin"),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await waitFor(() =>
      expect(canvas.getByRole("status")).toHaveTextContent("Install sane-backends with Homebrew"),
    );
    await expect(
      canvas.findByRole("button", { name: "Copy command" }),
    ).resolves.toBeInTheDocument();
    await expect(canvas.getByText("brew install sane-backends")).toBeVisible();
    markStoryPlayComplete("MissingSane");
  },
};
export const NoDevice: Story = { beforeEach: () => load("not-found") };
export const Busy: Story = { beforeEach: () => load("busy") };
export const Browser: Story = {
  beforeEach: () => load(),
  play: async ({ canvasElement }) => {
    expect(within(canvasElement).queryByRole("button", { name: "Scan" })).not.toBeInTheDocument();
    markStoryPlayComplete("Browser");
  },
};
export const Phone: Story = {
  beforeEach: () => load(),
  globals: { viewport: { value: "mobile1" } },
};
export const ScanAndCancel: Story = {
  beforeEach: () => load("ready"),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(await canvas.findByRole("button", { name: "Scan" }));
    await userEvent.click(await canvas.findByRole("button", { name: "Cancel scan" }));
    await expect(canvas.findByRole("button", { name: "Scan" })).resolves.toBeEnabled();
    markStoryPlayComplete("ScanAndCancel");
  },
};

async function openDestination(canvasElement: HTMLElement) {
  const screen = within(canvasElement.ownerDocument.body);
  await userEvent.click(within(canvasElement).getByRole("button", { name: "Scanner settings" }));
  const destination = await screen.findByRole("menuitem", { name: "Destination…" });
  await waitFor(() => {
    let element: HTMLElement | null = destination;
    while (element) {
      if (getComputedStyle(element).pointerEvents === "none") {
        throw new Error("Destination menu item is not interactive yet");
      }
      element = element.parentElement;
    }
  });
  await userEvent.click(destination);
  return within(await screen.findByRole("dialog", { name: "Scan destination" }));
}

export const DestinationValidation: Story = {
  beforeEach: () => load("ready"),
  play: async ({ canvasElement }) => {
    const screen = within(canvasElement.ownerDocument.body);
    let dialog = await openDestination(canvasElement);
    await userEvent.clear(dialog.getByLabelText("Folder"));
    await userEvent.type(dialog.getByLabelText("Folder"), "Operations//Invoices");
    await userEvent.click(dialog.getByRole("button", { name: "Save" }));
    await expect(dialog.getByRole("alert")).toHaveTextContent("Enter a valid folder path");
    await expect(screen.getAllByRole("alert")).toHaveLength(1);
    await expect(window.rakazoDesktop?.scanner?.setFolder).not.toHaveBeenCalled();
    await userEvent.click(dialog.getByRole("button", { name: "Cancel" }));
    await waitFor(() => expect(screen.queryByRole("alert")).not.toBeInTheDocument());

    dialog = await openDestination(canvasElement);
    await expect(dialog.getByLabelText("Folder")).toHaveValue("Scans");
    await expect(dialog.queryByRole("alert")).not.toBeInTheDocument();
    await userEvent.clear(dialog.getByLabelText("Folder"));
    await userEvent.type(dialog.getByLabelText("Folder"), "Operations//Invoices");
    await userEvent.click(dialog.getByRole("button", { name: "Save" }));
    await userEvent.clear(dialog.getByLabelText("Folder"));
    await expect(dialog.queryByRole("alert")).not.toBeInTheDocument();
    await userEvent.type(dialog.getByLabelText("Folder"), " Operations / Invoices ");
    await userEvent.click(dialog.getByRole("button", { name: "Save" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    await expect(window.rakazoDesktop?.scanner?.setFolder).toHaveBeenCalledWith([
      "Operations",
      "Invoices",
    ]);

    dialog = await openDestination(canvasElement);
    await expect(dialog.getByLabelText("Folder")).toHaveValue("Operations/Invoices");
    await userEvent.type(dialog.getByLabelText("Folder"), "//");
    await userEvent.click(dialog.getByRole("button", { name: "Save" }));
    await userEvent.keyboard("{Escape}");
    await waitFor(() => expect(screen.queryByRole("alert")).not.toBeInTheDocument());
    dialog = await openDestination(canvasElement);
    await expect(dialog.getByLabelText("Folder")).toHaveValue("Operations/Invoices");
    await expect(dialog.queryByRole("alert")).not.toBeInTheDocument();
    await userEvent.type(dialog.getByLabelText("Folder"), "//");
    await userEvent.click(dialog.getByRole("button", { name: "Save" }));
    await expect(dialog.getByRole("alert")).toHaveTextContent("Enter a valid folder path");
    markStoryPlayComplete("DestinationValidation");
  },
};

export const DestinationKeepsScannerError: Story = {
  beforeEach: () => load("error"),
  play: async ({ canvasElement }) => {
    const screen = within(canvasElement.ownerDocument.body);
    const dialog = await openDestination(canvasElement);
    await userEvent.type(dialog.getByLabelText("Folder"), "//");
    await userEvent.click(dialog.getByRole("button", { name: "Save" }));
    await userEvent.click(dialog.getByRole("button", { name: "Cancel" }));
    await waitFor(() => expect(screen.getAllByRole("alert")).toHaveLength(1));
    await expect(
      screen.getByText("Paper jam. Clear the feeder and retry the whole batch."),
    ).toBeVisible();
    markStoryPlayComplete("DestinationKeepsScannerError");
  },
};
