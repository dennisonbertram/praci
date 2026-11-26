import type { PinFormat } from "@rakazo/contracts";

/** Value at an RFC 6901 JSON Pointer ("" is the whole document). Throws when it is absent. */
export function jsonPointerGet(doc: unknown, pointer: string): unknown {
  if (pointer === "") return doc;
  if (!pointer.startsWith("/")) throw new Error(`Path "${pointer}" must start with "/"`);
  let current = doc;
  for (const raw of pointer.slice(1).split("/")) {
    const key = raw.replace(/~1/g, "/").replace(/~0/g, "~");
    if (
      current === null ||
      typeof current !== "object" ||
      !Object.hasOwn(current, key) ||
      (Array.isArray(current) && !/^(0|[1-9]\d*)$/.test(key))
    ) {
      throw new Error(`Nothing at "${pointer}" in the result`);
    }
    current = (current as Record<string, unknown>)[key];
  }
  return current;
}

/** Display text for a value; stays within the 40 characters a stat allows. */
export function formatPinValue(value: unknown, format: PinFormat): string {
  if (format === "text") {
    return (typeof value === "string" ? value : JSON.stringify(value)).slice(0, 40);
  }
  const n = typeof value === "string" && value.trim() !== "" ? Number(value) : value;
  if (typeof n !== "number" || !Number.isFinite(n)) throw new Error("The value is not a number");
  if (format === "percent") return `${n.toFixed(1)}%`;
  if (format === "number") return new Intl.NumberFormat("en-US").format(n);
  const digits = Math.abs(n) >= 1000 ? 0 : 2;
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(n);
}
