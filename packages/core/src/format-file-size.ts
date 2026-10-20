const FILE_SIZE_UNITS = ["B", "KB", "MB", "GB", "TB"] as const;

/** With a `locale`, sizes above bytes always show one decimal ("3.0 MB") in that locale's number format. */
export function formatFileSize(bytes: number, locale?: string): string {
  if (!Number.isFinite(bytes) || bytes < 0) return "";
  let value = bytes;
  let unit = 0;
  while (unit < FILE_SIZE_UNITS.length - 1 && value >= 1024) {
    value /= 1024;
    unit += 1;
  }
  if (unit === 0) return `${Math.round(value)} B`;
  let rounded = Math.round(value * 10) / 10;
  if (rounded >= 1024 && unit < FILE_SIZE_UNITS.length - 1) {
    rounded = Math.round((rounded / 1024) * 10) / 10;
    unit += 1;
  }
  const text = locale
    ? new Intl.NumberFormat(locale, { minimumFractionDigits: 1, maximumFractionDigits: 1 }).format(
        rounded,
      )
    : Number.isInteger(rounded)
      ? String(rounded)
      : rounded.toFixed(1);
  return `${text} ${FILE_SIZE_UNITS[unit]}`;
}
