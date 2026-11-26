import type { fullyDilutedParts } from "@rakazo/core/equity";

export { fullyDilutedParts } from "@rakazo/core/equity";

/** `part` of `whole` as a percent string with 4 places, the shape the API sends. */
export function percentText(part: bigint, whole: bigint): string {
  if (whole === 0n) return "0.0000";
  const scaled = (part * 1_000_000n * 2n + whole) / (whole * 2n);
  return `${scaled / 10_000n}.${(scaled % 10_000n).toString().padStart(4, "0")}`;
}

/** Percents with one decimal that add up to exactly 100 (largest remainder), for the bar legend. */
export function percentsTo100(parts: readonly bigint[], whole: bigint): number[] {
  if (whole === 0n) return parts.map(() => 0);
  const tenths = parts.map((part) => (part * 1000n) / whole);
  const remainders = parts.map((part, i) => ({ i, rest: part * 1000n - tenths[i]! * whole }));
  let missing = 1000n - tenths.reduce((sum, value) => sum + value, 0n);
  for (const { i } of remainders.sort((a, b) => (b.rest > a.rest ? 1 : b.rest < a.rest ? -1 : 0))) {
    if (missing <= 0n) break;
    tenths[i] = tenths[i]! + 1n;
    missing -= 1n;
  }
  return tenths.map((value) => Number(value) / 10);
}

/** The ownership bar's segments and pool, from the same parts as the table, adding up to 100. */
export function ownershipLegend(
  parts: ReturnType<typeof fullyDilutedParts>,
  names: { common: string; preferred: string; options: string; other: string },
) {
  const issued = (type: string) =>
    parts.classes
      .filter((row) => row.classType === type)
      .reduce((sum, row) => sum + row.shares, 0n);
  const segments = [
    { name: names.common, shares: issued("common") },
    { name: names.preferred, shares: issued("preferred") },
    { name: names.options, shares: parts.options },
    { name: names.other, shares: parts.other },
  ];
  const percents = percentsTo100([...segments.map((row) => row.shares), parts.pool], parts.total);
  return {
    classes: segments
      .map((row, i) => ({ name: row.name, percent: percents[i]!, shares: row.shares }))
      .filter((row) => row.shares > 0n)
      .map(({ name, percent }) => ({ name, percent })),
    pool: percents[segments.length]!,
  };
}
