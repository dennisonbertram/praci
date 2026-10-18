import type { DataRoomApiFolder, DataRoomApiItem } from "@rakazo/contracts";

export const folders: DataRoomApiFolder[] = [
  {
    id: "fld_contracts",
    name: "Contracts",
    parentId: null,
    createdAt: "2026-01-01T00:00:00.000Z",
    itemCount: 2,
  },
  {
    id: "fld_sample",
    name: "Sample vendor",
    parentId: "fld_contracts",
    createdAt: "2026-01-01T00:00:00.000Z",
    itemCount: 3,
  },
  { id: "fld_reports", name: "Reports", parentId: null, createdAt: "2026-01-01T00:00:00.000Z" },
];

const facets = {
  docType: "Contract",
  docDate: "2026-01-15T00:00:00.000Z",
  parties: ["Example Co", "Sample Ltd"],
  amountCents: 120000,
  currency: "USD",
  tags: ["sample"],
  summary: "A sample agreement between two fictional companies.",
};

const item = (id: string, name: string, over: Partial<DataRoomApiItem> = {}): DataRoomApiItem => ({
  id,
  name,
  mimeType: "text/plain",
  size: 2400,
  folderId: "fld_sample",
  source: "upload",
  sourceUrl: null,
  status: "ready",
  error: null,
  facets,
  createdAt: "2026-01-02T00:00:00.000Z",
  ...over,
});

export const readyItem = item("itm_ready", "Sample agreement.txt");
export const failedItem = item("itm_failed", "Broken sample.pdf", {
  status: "failed",
  error: "Could not read this file",
  facets: { ...facets, docType: null, docDate: null, parties: [], summary: null },
});
export const items: DataRoomApiItem[] = [
  readyItem,
  item("itm_pending", "Reading sample.pdf", {
    status: "extracting",
    facets: { ...facets, docType: null, docDate: null, parties: [], summary: null },
  }),
  failedItem,
  item("itm_mail", "Sample thread", { source: "gmail", folderId: null }),
];
