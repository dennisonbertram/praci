import { t } from "@lingui/core/macro";
import { Trans } from "@lingui/react/macro";
import type { LegalGraph as Graph, LegalNode, LegalNodeKind } from "@rakazo/contracts";
import { cn } from "@rakazo/ui-web";
import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { DATA_ROOM_PATH } from "../../lib/data-room";
import { maskCurrencyWhenHidden, useHideAmounts } from "../../lib/hide-amounts-preference";

/** Most nodes drawn; past this the busiest ones are kept and a note says so. */
export const MAX_GRAPH_NODES = 120;

// Left to right: the parties a contract binds, the contracts, then what the contracts say (where they
// are governed, what they oblige). Every edge then joins neighbouring columns instead of crossing one.
const COLUMN_ORDER: LegalNodeKind[] = [
  "company",
  "person",
  "contract",
  "jurisdiction",
  "obligation",
  "right",
  "asset",
  "other",
];
const COLUMN_W = 290;
const ROW = 46;
const PAD = 24;
const NODE_W = 200;
const NODE_H = 36;
/** Characters per label line at 11px in a NODE_W box. */
const LINE_CHARS = 30;

const kindName = (kind: LegalNodeKind): string =>
  ({
    company: t`Company`,
    person: t`Person`,
    contract: t`Contract`,
    obligation: t`Obligation`,
    right: t`Right`,
    asset: t`Asset`,
    jurisdiction: t`Jurisdiction`,
    other: t`Other`,
  })[kind];

/** Relations are stored as short verbs like "party_to"; show them as words. */
const relationText = (relation: string) => relation.replace(/_/g, " ");

/** A label on at most two lines, broken at a space; what does not fit ends in "…". */
export function labelLines(label: string, width = LINE_CHARS): string[] {
  if (label.length <= width) return [label];
  const cut = label.lastIndexOf(" ", width);
  const first = cut > 0 ? label.slice(0, cut) : label.slice(0, width);
  const rest = label.slice(first.length).trim();
  return [first, rest.length > width ? `${rest.slice(0, width - 1).trimEnd()}…` : rest];
}

type Placed = { node: LegalNode; x: number; y: number };

/**
 * ponytail: one column per node kind in a fixed order, three barycenter sweeps to cut crossings, no
 * edge routing. Upgrade to a layered layout library once graphs routinely cross a few hundred edges.
 */
function layout(graph: Graph) {
  const degree = new Map<string, number>();
  const neighbours = new Map<string, string[]>();
  for (const edge of graph.edges) {
    degree.set(edge.fromId, (degree.get(edge.fromId) ?? 0) + 1);
    degree.set(edge.toId, (degree.get(edge.toId) ?? 0) + 1);
    neighbours.set(edge.fromId, [...(neighbours.get(edge.fromId) ?? []), edge.toId]);
    neighbours.set(edge.toId, [...(neighbours.get(edge.toId) ?? []), edge.fromId]);
  }
  const hidden = Math.max(0, graph.nodes.length - MAX_GRAPH_NODES);
  const kept =
    hidden === 0
      ? graph.nodes
      : [...graph.nodes]
          .sort((a, b) => (degree.get(b.id) ?? 0) - (degree.get(a.id) ?? 0))
          .slice(0, MAX_GRAPH_NODES);
  const byLabel = (a: LegalNode, b: LegalNode) => a.label.localeCompare(b.label);
  const columns = COLUMN_ORDER.map((kind) =>
    kept.filter((node) => node.kind === kind).sort(byLabel),
  ).filter((column) => column.length > 0);
  // Each column sits next to what it links to: sort it by the average row of its neighbours in the
  // column just ordered, sweeping right, then left, then right again.
  const rowOf = new Map<string, number>();
  const number = (column: LegalNode[]) =>
    column.forEach((node, r) => {
      rowOf.set(node.id, r);
    });
  const reorder = (column: LegalNode[], beside: LegalNode[]) => {
    const near = new Set(beside.map((node) => node.id));
    const centre = (node: LegalNode) => {
      const rows = (neighbours.get(node.id) ?? [])
        .filter((id) => near.has(id))
        .map((id) => rowOf.get(id) ?? 0);
      return rows.length
        ? rows.reduce((sum, row) => sum + row, 0) / rows.length
        : (rowOf.get(node.id) ?? 0);
    };
    const centres = new Map(column.map((node) => [node.id, centre(node)]));
    column.sort((a, b) => (centres.get(a.id) ?? 0) - (centres.get(b.id) ?? 0) || byLabel(a, b));
    number(column);
  };
  for (const column of columns) number(column);
  for (let c = 1; c < columns.length; c++) reorder(columns[c]!, columns[c - 1]!);
  for (let c = columns.length - 2; c >= 0; c--) reorder(columns[c]!, columns[c + 1]!);
  for (let c = 1; c < columns.length; c++) reorder(columns[c]!, columns[c - 1]!);
  const width = columns.length * COLUMN_W;
  const rows = Math.max(1, ...columns.map((column) => column.length));
  const height = PAD * 2 + 20 + rows * ROW;
  const placed = new Map<string, Placed>();
  columns.forEach((column, c) => {
    const top = PAD + 20 + ((rows - column.length) * ROW) / 2;
    column.forEach((node, r) => {
      placed.set(node.id, { node, x: COLUMN_W * (c + 0.5), y: top + r * ROW + ROW / 2 });
    });
  });
  const heads = columns.map((column, c) => ({ kind: column[0]?.kind, x: COLUMN_W * (c + 0.5) }));
  const edges = graph.edges.filter((edge) => placed.has(edge.fromId) && placed.has(edge.toId));
  return { placed, edges, heads, width, height, hidden };
}

/** An edge from the side of one box to the facing side of the other, so it never runs behind a box. */
function edgePath(from: Placed, to: Placed): string {
  const [left, right] = from.x <= to.x ? [from, to] : [to, from];
  const x1 = left.x + (left.x === right.x ? 0 : NODE_W / 2);
  const x2 = right.x - (left.x === right.x ? 0 : NODE_W / 2);
  const mid = (x1 + x2) / 2;
  return `M${x1} ${left.y} C${mid} ${left.y} ${mid} ${right.y} ${x2} ${right.y}`;
}

/** Nodes and edges as an SVG diagram. Selecting a node highlights its edges and lists its relations below. */
export function LegalGraphView({ graph }: { graph: Graph }) {
  useHideAmounts();
  const [selected, setSelected] = useState<string | null>(null);
  const { placed, edges, heads, width, height, hidden } = useMemo(() => layout(graph), [graph]);
  // Drawn at its own size so labels stay readable; when that is wider than the page, say it scrolls.
  const frame = useRef<HTMLDivElement>(null);
  const [scrolls, setScrolls] = useState(false);
  useEffect(() => {
    const el = frame.current;
    if (!el) return;
    const check = () => setScrolls(el.scrollWidth > el.clientWidth + 1);
    check();
    const observer = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(check);
    observer?.observe(el);
    return () => observer?.disconnect();
  }, [width]);
  if (graph.nodes.length === 0) {
    return (
      <p className="py-8 text-center text-sm text-muted-foreground">
        <Trans>No relationships yet.</Trans>
      </p>
    );
  }
  const selectedNode = selected ? placed.get(selected)?.node : undefined;
  const related = selectedNode
    ? edges.filter((edge) => edge.fromId === selectedNode.id || edge.toId === selectedNode.id)
    : [];
  const selectedLabel = maskCurrencyWhenHidden(selectedNode?.label ?? "");
  const shown = Math.min(graph.nodes.length, MAX_GRAPH_NODES);
  const total = graph.nodes.length;
  const labelOf = (nodeId: string) => maskCurrencyWhenHidden(placed.get(nodeId)?.node.label ?? "");
  return (
    <div className="flex flex-col gap-3">
      {hidden > 0 ? (
        <p className="text-xs text-muted-foreground">
          <Trans>
            Showing the {shown} most connected of {total} items.
          </Trans>
        </p>
      ) : null}
      {scrolls ? (
        <p className="text-xs text-muted-foreground">
          <Trans>Scroll sideways to see the whole graph.</Trans>
        </p>
      ) : null}
      <div ref={frame} className="overflow-x-auto rounded-xl border border-border bg-card">
        {/* biome-ignore lint/a11y/useSemanticElements: an SVG cannot be a fieldset */}
        <svg
          role="group"
          aria-label={t`Legal relationships`}
          viewBox={`0 0 ${width} ${height}`}
          width={width}
          height={height}
          className="mx-auto block max-w-none"
        >
          {heads.map((head) => (
            <text
              key={head.kind}
              x={head.x}
              y={PAD}
              textAnchor="middle"
              className="fill-muted-foreground text-[11px]"
            >
              {head.kind ? kindName(head.kind) : ""}
            </text>
          ))}
          {edges.map((edge) => {
            const from = placed.get(edge.fromId);
            const to = placed.get(edge.toId);
            if (!from || !to) return null;
            const on = selected === edge.fromId || selected === edge.toId;
            return (
              <path
                key={edge.id}
                d={edgePath(from, to)}
                fill="none"
                className={cn(
                  on ? "stroke-foreground" : "stroke-muted-foreground",
                  selected && !on && "opacity-30",
                )}
                strokeWidth={on ? 2.5 : 1.5}
              >
                <title>{relationText(edge.relation)}</title>
              </path>
            );
          })}
          {[...placed.values()].map(({ node, x, y }) => (
            // biome-ignore lint/a11y/useSemanticElements: SVG has no button element
            <g
              key={node.id}
              role="button"
              tabIndex={0}
              aria-label={`${kindName(node.kind)}: ${maskCurrencyWhenHidden(node.label)}`}
              aria-pressed={selected === node.id}
              className="cursor-pointer outline-none [&:focus-visible>rect]:stroke-foreground [&:focus-visible>rect]:stroke-2"
              onClick={() => setSelected(selected === node.id ? null : node.id)}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  setSelected(selected === node.id ? null : node.id);
                }
              }}
            >
              <rect
                x={x - NODE_W / 2}
                y={y - NODE_H / 2}
                width={NODE_W}
                height={NODE_H}
                rx={6}
                strokeWidth={selected === node.id ? 2 : 1}
                className={cn(
                  "stroke-border",
                  node.kind === "contract" ? "fill-muted" : "fill-card",
                  selected === node.id && "stroke-foreground",
                )}
              />
              <text
                x={x}
                y={y}
                textAnchor="middle"
                className={cn(
                  "fill-foreground text-[11px]",
                  node.kind === "contract" && "font-medium",
                )}
              >
                {labelLines(maskCurrencyWhenHidden(node.label)).map((line, i, lines) => (
                  <tspan key={i} x={x} dy={i === 0 ? (lines.length === 1 ? 4 : -2) : 13}>
                    {line}
                  </tspan>
                ))}
              </text>
            </g>
          ))}
        </svg>
      </div>
      {selectedNode ? (
        <section aria-label={t`Relations of ${selectedLabel}`} className="text-sm">
          <h3 className="mb-1 font-medium">{selectedLabel}</h3>
          {related.length === 0 ? (
            <p className="text-xs text-muted-foreground">
              <Trans>No relations.</Trans>
            </p>
          ) : (
            <ul className="flex flex-col gap-2">
              {related.map((edge) => (
                <li key={edge.id}>
                  <span>
                    {labelOf(edge.fromId)}{" "}
                    <span className="text-muted-foreground">{relationText(edge.relation)}</span>{" "}
                    {labelOf(edge.toId)}
                  </span>
                  {edge.sourceQuote ? (
                    <blockquote className="mt-0.5 border-s-2 border-border ps-2 text-xs text-muted-foreground">
                      {maskCurrencyWhenHidden(edge.sourceQuote)}
                    </blockquote>
                  ) : null}
                  {edge.dataRoomItemId ? (
                    <Link
                      to={`${DATA_ROOM_PATH}?item=${edge.dataRoomItemId}`}
                      className="text-xs text-muted-foreground hover:underline"
                    >
                      <Trans>Open document</Trans>
                    </Link>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </section>
      ) : (
        <p className="text-xs text-muted-foreground">
          <Trans>Select an item to see its relations.</Trans>
        </p>
      )}
    </div>
  );
}
