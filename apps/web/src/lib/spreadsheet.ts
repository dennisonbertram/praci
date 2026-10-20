/** A file the server can preview as a table: .xlsx, .xlsm, .csv or .tsv (legacy .xls is not). */
export function canPreviewSpreadsheet(name: string, mimeType: string): boolean {
  const ext = /\.([a-z0-9]+)$/i.exec(name)?.[1]?.toLowerCase();
  const type = mimeType.toLowerCase().split(";")[0]?.trim() ?? "";
  if (ext === "xls" || type === "application/vnd.ms-excel") return false;
  return (
    ["xlsx", "xlsm", "csv", "tsv"].includes(ext ?? "") ||
    type.includes("spreadsheetml.sheet") ||
    type === "application/vnd.ms-excel.sheet.macroenabled.12" ||
    type === "text/csv" ||
    type === "text/tab-separated-values"
  );
}
