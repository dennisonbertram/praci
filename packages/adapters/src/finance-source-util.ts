import type { z } from "zod";

/**
 * A tool answered in a shape the mapper does not know. The message names the tool and the first
 * offending field path only, never a value, so it is safe to show on the Finance page.
 */
export class FinanceShapeError extends Error {
  constructor(tool: string, path: string) {
    super(`Unexpected ${tool} response${path ? ` at ${path}` : ""}`);
    this.name = "FinanceShapeError";
  }
}

/** Validates one tool response; throws FinanceShapeError so a changed vendor API fails the sync. */
export function parseToolResponse<T extends z.ZodType>(
  schema: T,
  tool: string,
  data: unknown,
): z.infer<T> {
  const parsed = schema.safeParse(data);
  if (!parsed.success)
    throw new FinanceShapeError(tool, parsed.error.issues[0]?.path.join(".") ?? "");
  return parsed.data;
}

/** Dollars (a JSON number or a decimal string) to whole cents. */
export function dollarsToCents(value: number | string): number {
  const cents = Math.round(Number(value) * 100);
  if (!Number.isFinite(cents)) throw new FinanceShapeError("money", "");
  return cents;
}

/** `YYYY-MM-DD` of an ISO instant, for vendor date filters. */
export const isoDay = (iso: string): string => iso.slice(0, 10);

/** An ISO instant for any date string the vendor sends; throws if it is not a date. */
export function toIso(value: string, tool: string): string {
  const time = Date.parse(value);
  if (Number.isNaN(time)) throw new FinanceShapeError(tool, "date");
  return new Date(time).toISOString();
}

const MIME_BY_EXTENSION: Record<string, string> = {
  pdf: "application/pdf",
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  heic: "image/heic",
};

export function mimeTypeFromName(name: string | null | undefined): string | null {
  const extension = name?.split("?")[0]?.split(".").pop()?.toLowerCase();
  return (extension && MIME_BY_EXTENSION[extension]) || null;
}
