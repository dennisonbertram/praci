import type { Meta, StoryObj } from "@storybook/react-vite";
import { useEffect } from "react";
import { DataRoomDropZone } from "./DropZone";
import { showDeletedToast, showSortedToast, showToastForStory } from "./upload-toasts";

const meta = {
  title: "DataRoom/DropZone",
  render: () => (
    <div className="p-4 text-sm">
      Drag a file over this page.
      <DataRoomDropZone userId="usr_sample" />
    </div>
  ),
} satisfies Meta;
export default meta;

export const Idle: StoryObj = {};

function UploadingToast() {
  useEffect(() => {
    showToastForStory("Q3 contracts.zip", { kind: "uploading", fraction: 0.4, cancel: () => {} });
  }, []);
  return null;
}
/** An upload in progress, with Cancel available while progress continues. */
export const Uploading: StoryObj = {
  render: () => (
    <div className="p-4 text-sm">
      <DataRoomDropZone userId="usr_sample" />
      <UploadingToast />
    </div>
  ),
};

function DeletedToast() {
  // After the drop zone has set its scope, which clears earlier toasts.
  useEffect(() => showDeletedToast("Sample lease.pdf"), []);
  return null;
}
/** The confirmation after an item is deleted. */
export const Deleted: StoryObj = {
  render: () => (
    <div className="p-4 text-sm">
      <DataRoomDropZone userId="usr_sample" />
      <DeletedToast />
    </div>
  ),
};

function SortedToast() {
  useEffect(() => showSortedToast(5, "batch_sample"), []);
  return null;
}
/** The confirmation after Auto-sort, with Undo for that batch. */
export const Sorted: StoryObj = {
  render: () => (
    <div className="p-4 text-sm">
      <DataRoomDropZone userId="usr_sample" />
      <SortedToast />
    </div>
  ),
};

const row = {
  id: "imp_sample",
  source: "upload",
  total: 12,
  done: 0,
  failed: 0,
  inProgress: 12,
  finished: false,
  added: 0,
  stage: "opening" as "opening" | "adding" | "reading" | "done" | null,
  currentName: null as string | null,
  latest: [],
};
function ImportToasts() {
  useEffect(() => {
    showToastForStory("Q3 contracts.zip", { kind: "importing", progress: null });
    showToastForStory("Q3 contracts.zip", {
      kind: "importing",
      progress: { ...row, stage: "adding" },
    });
    showToastForStory("Q3 contracts.zip", {
      kind: "importing",
      progress: { ...row, stage: "adding", added: 5, currentName: "lease-2026.pdf" },
    });
    showToastForStory("Q3 contracts.zip", {
      kind: "importing",
      progress: { ...row, stage: "done", added: 12, done: 7 },
    });
    showToastForStory("Q3 contracts.zip", { kind: "imported", count: 12 });
    showToastForStory("Q3 contracts.zip", { kind: "imported", count: 10, failed: 2 });
  }, []);
  return null;
}
/** A zip after its upload: opened, found, added entry by entry, read, then added (one partly failed). */
export const ZipStages: StoryObj = {
  render: () => (
    <div className="p-4 text-sm">
      <DataRoomDropZone userId="usr_sample" />
      <ImportToasts />
    </div>
  ),
};

function FailedToasts() {
  useEffect(() => {
    showToastForStory("notes.txt", { kind: "error", reason: "network", retry: () => {} });
    showToastForStory("lease.pdf", { kind: "error", reason: "failed", retry: () => {} });
  }, []);
  return null;
}
/** Failed uploads say why and stay until closed; network and server failures offer Retry. */
export const Failed: StoryObj = {
  render: () => (
    <div className="p-4 text-sm">
      <DataRoomDropZone userId="usr_sample" />
      <FailedToasts />
    </div>
  ),
};
