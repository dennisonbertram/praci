import type { DataRoomApiStats } from "@rakazo/contracts";

const months = Array.from({ length: 24 }, (_, n) => ({
  key: `${2025 + Math.floor(n / 12)}-${String((n % 12) + 1).padStart(2, "0")}`,
  count: [
    4, 9, 31, 12, 7, 55, 80, 42, 18, 26, 61, 90, 33, 15, 70, 120, 64, 38, 22, 51, 98, 76, 44, 19,
  ][n] as number,
}));

/** About a thousand invented documents over two years. */
export const manyDocuments: DataRoomApiStats = {
  documents: 1_104,
  bytes: 2_410_000_000,
  duplicates: 18,
  status: { ready: 1_020, processing: 41, failed: 12, notSearchable: 31 },
  types: [
    { value: "legal", count: 410 },
    { value: "investor", count: 255 },
    { value: "tax", count: 140 },
    { value: "hr", count: 96 },
    { value: "correspondence", count: 60 },
  ],
  sources: [
    { value: "drive", count: 700 },
    { value: "upload", count: 240 },
    { value: "gmail", count: 120 },
    { value: "box", count: 44 },
  ],
  dates: { unit: "month", buckets: months },
  parties: [
    { value: "Acme Capital (Mock)", count: 64 },
    { value: "Example Legal LLP (Mock)", count: 51 },
    { value: "Sample Ventures (Mock)", count: 33 },
    { value: "Placeholder Bank (Mock)", count: 21 },
  ],
  largest: [
    { id: "f1", name: "Board recording.mov", size: 480_000_000 },
    { id: "f2", name: "Data export.zip", size: 212_000_000 },
    { id: "f3", name: "Scanned binder.pdf", size: 96_000_000 },
  ],
  amounts: [
    { docType: "investor", currency: "USD", cents: 1_250_000_000, count: 22 },
    { docType: "legal", currency: "USD", cents: 410_000_000, count: 31 },
  ],
};

export const noDocuments: DataRoomApiStats = {
  documents: 0,
  bytes: 0,
  duplicates: 0,
  status: { ready: 0, processing: 0, failed: 0, notSearchable: 0 },
  types: [],
  sources: [],
  dates: { unit: "month", buckets: [] },
  parties: [],
  largest: [],
  amounts: [],
};
