import { t } from "@lingui/core/macro";
import { Trans } from "@lingui/react/macro";
import type { BrexCategorySpend, BrexSpendBucket, BrexSpendSankey } from "@rakazo/contracts";
import { axisMoney } from "../../lib/finance-format";
import { useHideAmounts } from "../../lib/hide-amounts-preference";
import { Chart } from "../finance/charts";
import { usePhone } from "../ListControls";

const BAR = 8;
const TOP_MERCHANTS = 10;

type Sized = { cents: number };

function layout<T extends Sized>(nodes: readonly T[], total: number, top: number, height: number) {
  const unit = height / total;
  let y = top;
  return nodes.map((node) => {
    const placed = { ...node, y, h: Math.max(2, node.cents * unit) };
    y += placed.h;
    return placed;
  });
}

function bandPath(x1: number, y1: number, h1: number, x2: number, y2: number, h2: number) {
  const bend = Math.max(20, (x2 - x1) * 0.45);
  return `M ${x1} ${y1} C ${x1 + bend} ${y1}, ${x2 - bend} ${y2}, ${x2} ${y2} L ${x2} ${y2 + h2} C ${x2 - bend} ${y2 + h2}, ${x1 + bend} ${y1 + h1}, ${x1} ${y1 + h1} Z`;
}

function shortName(name: string) {
  return name.length > 22 ? `${name.slice(0, 21)}…` : name;
}

function categoryLabel(bucket: BrexSpendBucket): string {
  switch (bucket) {
    case "software":
      return t`Software`;
    case "cloud":
      return t`Cloud`;
    case "travel":
      return t`Travel`;
    case "meals":
      return t`Meals`;
    case "marketing":
      return t`Marketing`;
    case "other":
      return t`Other`;
  }
}

function SourceLabel({ x, total }: { x: number; total: number }) {
  return (
    <text x={x} y={18} textAnchor="middle" className="fill-muted-foreground text-[11px]">
      <tspan x={x} dy="0">
        {t`Card spend`}
      </tspan>
      <tspan x={x} dy="14" className="fill-foreground font-medium">
        {axisMoney(total)}
      </tspan>
    </text>
  );
}

function PhoneSankey({
  data,
  categories,
  width,
  height,
}: {
  data: BrexSpendSankey;
  categories: BrexCategorySpend[];
  width: number;
  height: number;
}) {
  const top = 34;
  const plot = height - top - 8;
  const sourceX = 58;
  const categoryX = Math.max(sourceX + 120, width * 0.58);
  const nodes = layout(categories, data.totalCents, top, plot);
  return (
    <g>
      {nodes.map((node) => (
        <path
          key={`link-${node.bucket}`}
          d={bandPath(sourceX + BAR, node.y, node.h, categoryX, node.y, node.h)}
          className="fill-foreground/20"
        />
      ))}
      <rect x={sourceX} y={top} width={BAR} height={plot} className="fill-foreground" />
      {nodes.map((node) => (
        <rect
          key={node.bucket}
          x={categoryX}
          y={node.y + 1}
          width={BAR}
          height={Math.max(1, node.h - 2)}
          className="fill-foreground"
        />
      ))}
      <SourceLabel x={sourceX + BAR / 2} total={data.totalCents} />
      {nodes.map((node) =>
        node.h >= 18 ? (
          <text
            key={`label-${node.bucket}`}
            x={categoryX + BAR + 8}
            y={node.y + node.h / 2}
            dominantBaseline="middle"
            className="fill-muted-foreground text-[11px]"
          >
            <tspan>{categoryLabel(node.bucket)}</tspan>
            <tspan dx={6} className="fill-foreground">
              {axisMoney(node.cents)}
            </tspan>
          </text>
        ) : null,
      )}
    </g>
  );
}

function WideSankey({
  data,
  categories,
  width,
  height,
}: {
  data: BrexSpendSankey;
  categories: BrexCategorySpend[];
  width: number;
  height: number;
}) {
  const top = 34;
  const plot = height - top - 8;
  const unit = plot / data.totalCents;
  const sourceX = 86;
  const categoryX = width * 0.36;
  const merchantX = width * 0.68;
  const byMerchant = new Map<
    string,
    { name: string; cents: number; byCategory: Map<BrexSpendBucket, number> }
  >();
  for (const category of categories) {
    for (const merchant of category.merchants) {
      if (merchant.cents <= 0) continue;
      const current = byMerchant.get(merchant.merchant) ?? {
        name: merchant.merchant,
        cents: 0,
        byCategory: new Map<BrexSpendBucket, number>(),
      };
      current.cents += merchant.cents;
      current.byCategory.set(
        category.bucket,
        (current.byCategory.get(category.bucket) ?? 0) + merchant.cents,
      );
      byMerchant.set(merchant.merchant, current);
    }
  }
  const ranked = [...byMerchant.values()].sort((a, b) => b.cents - a.cents);
  const merchants = ranked.slice(0, TOP_MERCHANTS);
  const rest = ranked.slice(TOP_MERCHANTS);
  if (rest.length > 0) {
    const other = {
      name: t`All others`,
      cents: 0,
      byCategory: new Map<BrexSpendBucket, number>(),
    };
    for (const merchant of rest) {
      other.cents += merchant.cents;
      for (const [bucket, cents] of merchant.byCategory) {
        other.byCategory.set(bucket, (other.byCategory.get(bucket) ?? 0) + cents);
      }
    }
    merchants.push(other);
  }

  const categoryNodes = layout(categories, data.totalCents, top, plot).map((node, index) => ({
    ...node,
    key: categories[index]?.bucket ?? "other",
    bucket: categories[index]?.bucket as BrexSpendBucket,
  }));
  const merchantNodes = layout(merchants, data.totalCents, top, plot).map((node, index) => ({
    ...node,
    key: merchants[index]?.name ?? "merchant",
    name: merchants[index]?.name ?? "",
    byCategory: merchants[index]?.byCategory ?? new Map<BrexSpendBucket, number>(),
  }));

  const sourceLinks = categoryNodes.map((node) => ({
    key: `source-${node.bucket}`,
    d: bandPath(sourceX + BAR, node.y, node.h, categoryX, node.y, node.h),
  }));
  const outgoing = new Map<string, { merchantKey: string; cents: number }[]>();
  const incoming = new Map<string, { bucket: BrexSpendBucket; cents: number }[]>();
  for (const category of categoryNodes) {
    for (const merchant of merchantNodes) {
      const cents = merchant.byCategory.get(category.bucket) ?? 0;
      if (cents <= 0) continue;
      outgoing.set(category.bucket, [
        ...(outgoing.get(category.bucket) ?? []),
        { merchantKey: merchant.key, cents },
      ]);
      incoming.set(merchant.key, [
        ...(incoming.get(merchant.key) ?? []),
        { bucket: category.bucket, cents },
      ]);
    }
  }
  for (const list of outgoing.values())
    list.sort(
      (a, b) =>
        merchantNodes.findIndex((m) => m.key === a.merchantKey) -
        merchantNodes.findIndex((m) => m.key === b.merchantKey),
    );
  for (const list of incoming.values())
    list.sort(
      (a, b) =>
        categoryNodes.findIndex((c) => c.bucket === a.bucket) -
        categoryNodes.findIndex((c) => c.bucket === b.bucket),
    );

  const targetY = new Map<string, number>();
  for (const merchant of merchantNodes) {
    let y = merchant.y;
    for (const link of incoming.get(merchant.key) ?? []) {
      const h = Math.max(1, link.cents * unit);
      targetY.set(`${link.bucket}|${merchant.key}`, y);
      y += h;
    }
  }
  const categoryLinks: { key: string; d: string }[] = [];
  for (const category of categoryNodes) {
    let y = category.y;
    for (const link of outgoing.get(category.bucket) ?? []) {
      const h = Math.max(1, link.cents * unit);
      const merchant = merchantNodes.find((node) => node.key === link.merchantKey);
      const toY =
        targetY.get(`${category.bucket}|${link.merchantKey}`) ?? merchant?.y ?? category.y;
      categoryLinks.push({
        key: `${category.bucket}-${link.merchantKey}`,
        d: bandPath(categoryX + BAR, y, h, merchantX, toY, h),
      });
      y += h;
    }
  }

  return (
    <g>
      {[...sourceLinks, ...categoryLinks].map((link) => (
        <path key={link.key} d={link.d} className="fill-foreground/20" />
      ))}
      <rect x={sourceX} y={top} width={BAR} height={plot} className="fill-foreground" />
      {categoryNodes.map((node) => (
        <rect
          key={node.bucket}
          x={categoryX}
          y={node.y + 1}
          width={BAR}
          height={Math.max(1, node.h - 2)}
          className="fill-foreground"
        />
      ))}
      {merchantNodes.map((node) => (
        <rect
          key={node.key}
          x={merchantX}
          y={node.y + 1}
          width={BAR}
          height={Math.max(1, node.h - 2)}
          className="fill-foreground"
        />
      ))}
      <SourceLabel x={sourceX + BAR / 2} total={data.totalCents} />
      {categoryNodes.map((node) =>
        node.h >= 16 ? (
          <text
            key={`category-${node.bucket}`}
            x={categoryX - 8}
            y={node.y + node.h / 2}
            textAnchor="end"
            dominantBaseline="middle"
            className="fill-muted-foreground text-[11px]"
          >
            <tspan>{categoryLabel(node.bucket)}</tspan>
            <tspan x={categoryX - 8} dy="13" className="fill-foreground">
              {axisMoney(node.cents)}
            </tspan>
          </text>
        ) : null,
      )}
      {merchantNodes.map((node) =>
        node.h >= 14 ? (
          <text
            key={`merchant-${node.key}`}
            x={merchantX + BAR + 8}
            y={node.y + node.h / 2}
            dominantBaseline="middle"
            className="fill-muted-foreground text-[11px]"
          >
            <tspan>{shortName(node.name)}</tspan>
            <tspan dx={6} className="fill-foreground">
              {axisMoney(node.cents)}
            </tspan>
          </text>
        ) : null,
      )}
    </g>
  );
}

export function SpendSankey({ data }: { data: BrexSpendSankey }) {
  const phone = usePhone();
  useHideAmounts();
  const categories = data.categories
    .map((category) => {
      const merchants = category.merchants.filter((merchant) => merchant.cents > 0);
      return {
        ...category,
        merchants,
        cents: merchants.reduce((sum, merchant) => sum + merchant.cents, 0),
      };
    })
    .filter((category) => category.cents > 0)
    .sort((a, b) => b.cents - a.cents || a.bucket.localeCompare(b.bucket));
  const totalCents = categories.reduce((sum, category) => sum + category.cents, 0);
  if (totalCents <= 0) {
    return (
      <p className="py-8 text-center text-sm text-muted-foreground">
        <Trans>No card spend yet.</Trans>
      </p>
    );
  }
  const spend = { ...data, totalCents, categories };
  const height = phone ? 260 : 360;
  return (
    <Chart
      height={height}
      label={t`Card spend by category and merchant`}
      minWidth={phone ? 300 : 640}
    >
      {(width) =>
        phone ? (
          <PhoneSankey data={spend} categories={categories} width={width} height={height} />
        ) : (
          <WideSankey data={spend} categories={categories} width={width} height={height} />
        )
      }
    </Chart>
  );
}
