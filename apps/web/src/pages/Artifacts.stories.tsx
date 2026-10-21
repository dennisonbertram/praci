import type { Artifact } from "@rakazo/contracts";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { Navigate, Route, Routes } from "react-router-dom";
import { userEvent, within } from "storybook/test";
import { mockRpc, resetRpcMocks } from "../lib/__mocks__/rpc";
import { mockBot } from "../stories/fixtures";
import { ArtifactsPage } from "./Artifacts";

const base = (
  overrides: Partial<Artifact> & { id: string; name: string; versionCount?: number },
) => ({
  botId: mockBot.id,
  groupId: null,
  runId: null,
  description: null,
  mimeType: "text/markdown",
  size: 1200,
  version: 1,
  createdAt: "2026-01-01T00:00:00.000Z",
  versionCount: 1,
  ...overrides,
});

const items = [
  base({ id: "art_md", name: "Weekly notes", description: "Notes from the sample week." }),
  base({
    id: "art_html",
    name: "Sample dashboard",
    mimeType: "text/html",
    version: 3,
    versionCount: 3,
  }),
  base({ id: "art_pdf", name: "Sample report.pdf", mimeType: "application/pdf", botId: null }),
  base({ id: "art_img", name: "Sample chart.png", mimeType: "image/png" }),
  base({ id: "art_bin", name: "archive.zip", mimeType: "application/zip" }),
  base({ id: "art_csv", name: "Monthly burn.csv", mimeType: "text/csv" }),
  base({
    id: "art_long",
    name: "A very long artifact name that will not fit on a single line of the card",
    description:
      "A long description that goes on for several sentences so the card has to clamp it. It keeps going to show how the clamp behaves with plenty of text.",
  }),
];

// 1x1 transparent PNG.
const png =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==";
const b64 = (text: string) => btoa(text);

const content: Record<string, { mimeType: string; contentBase64: string }> = {
  art_md: {
    mimeType: "text/markdown",
    contentBase64: b64("# Weekly notes\n\nA short sample document.\n\n- One\n- Two"),
  },
  art_html: {
    mimeType: "text/html",
    contentBase64: b64("<h1>Sample dashboard</h1><p>Static demo page.</p>"),
  },
  art_img: { mimeType: "image/png", contentBase64: png },
  art_bin: { mimeType: "application/zip", contentBase64: b64("zip") },
};

const bootstrap = {
  bots: [mockBot, { ...mockBot, id: "bot_two", name: "Second bot", color: "#3B82F6" }],
  me: { ticketBoardEnabled: false },
};

const load = (list = items, nextCursor: string | null = null) =>
  mockRpc({
    bootstrap,
    "artifacts.listSpace": { items: list, nextCursor },
    "artifacts.listVersions": (input: unknown) => {
      const id = (input as { familyId: string }).familyId;
      return id === "art_html"
        ? [3, 2, 1].map((v) => ({
            id: `art_html_v${v}`,
            version: v,
            name: "Sample dashboard",
            createdAt: "2026-01-01T00:00:00.000Z",
          }))
        : [];
    },
    "artifacts.getById": (input: unknown) => {
      const id = (input as { artifactId: string }).artifactId.replace(/_v\d$/, "");
      const found = items.find((item) => item.id === id) ?? items[0];
      const { versionCount: _count, ...artifact } = found as (typeof items)[number];
      return { ...artifact, ...content[id], contentBase64: content[id]?.contentBase64 ?? b64("") };
    },
  });

function Page({ at = "/app/artifacts" }: { at?: string }) {
  return (
    <Routes>
      <Route path="/app/artifacts/:artifactId?" element={<ArtifactsPage onAskAgent={() => {}} />} />
      <Route path="*" element={<Navigate to={at} replace />} />
    </Routes>
  );
}

const meta = {
  beforeEach: () => resetRpcMocks(),
  title: "Artifacts/ArtifactsPage",
  parameters: {
    layout: "fullscreen",
    docs: {
      description: {
        component:
          "Also shows: BrowsingPane, LoadMoreButton, EmptyArtifacts, IndexPane, FilterChip, BotFilterChip, ViewModeButton, ArtifactCard, ArtifactRow, ArtifactMimeIcon, PreviewPane, ArtifactPreview, ImagePreview.",
      },
    },
  },
  decorators: [
    (Story) => (
      <div className="h-[640px]">
        <Story />
      </div>
    ),
  ],
  render: () => <Page />,
} satisfies Meta;
export default meta;
type Story = StoryObj;

export const Cards: Story = { beforeEach: () => load() };

export const CardsWithMore: Story = { beforeEach: () => load(items, "cursor_2") };

export const List: Story = {
  beforeEach: () => {
    load();
    try {
      window.localStorage.setItem("rakazo:artifacts-view-mode", "list");
    } catch {
      // Storage may be blocked; the story then shows cards.
    }
    return () => {
      try {
        window.localStorage.removeItem("rakazo:artifacts-view-mode");
      } catch {
        // Nothing to clean up.
      }
    };
  },
};

export const Loading: Story = {
  beforeEach: () =>
    mockRpc({ bootstrap, "artifacts.listSpace": () => new Promise(() => undefined) }),
};

export const LoadFailed: Story = {
  beforeEach: () =>
    mockRpc({ bootstrap, "artifacts.listSpace": () => Promise.reject(new Error("offline")) }),
};

export const Empty: Story = { beforeEach: () => load([]) };

export const EmptyWithMorePages: Story = { beforeEach: () => load([], "cursor_2") };

export const FiltersOpen: Story = {
  beforeEach: () => load(),
  play: async ({ canvasElement }) => {
    await userEvent.click(await within(canvasElement).findByRole("button", { name: "Filters" }));
  },
};

/** A search that matches nothing, with the Filters panel closed again: the button shows a dot and the list can be reset. */
export const NoMatch: Story = {
  beforeEach: () => load(),
  play: async ({ canvasElement }) => {
    const view = within(canvasElement);
    const filters = await view.findByRole("button", { name: "Filters" });
    await userEvent.click(filters);
    await userEvent.type(await view.findByPlaceholderText("Search artifacts…"), "zzzz");
    await userEvent.click(filters);
  },
};

export const MarkdownPreview: Story = {
  render: () => <Page at="/app/artifacts/art_md" />,
  beforeEach: () => load(),
};

export const HtmlPreviewWithVersions: Story = {
  render: () => <Page at="/app/artifacts/art_html" />,
  beforeEach: () => load(),
};

export const ImagePreviewStory: Story = {
  name: "ImagePreview",
  render: () => <Page at="/app/artifacts/art_img" />,
  beforeEach: () => load(),
};

export const UnsupportedPreview: Story = {
  render: () => <Page at="/app/artifacts/art_bin" />,
  beforeEach: () => load(),
};

export const PreviewFailed: Story = {
  render: () => <Page at="/app/artifacts/art_md" />,
  beforeEach: () => {
    load();
    mockRpc({ "artifacts.getById": () => Promise.reject(new Error("gone")) });
  },
};

export const DeleteConfirm: Story = {
  beforeEach: () => load(),
  play: async ({ canvasElement }) => {
    await userEvent.click(
      (await within(canvasElement).findAllByRole("button", { name: /^Delete / }))[0] as HTMLElement,
    );
  },
};
