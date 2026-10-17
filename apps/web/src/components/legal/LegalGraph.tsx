import { t } from "@lingui/core/macro";
import { Trans } from "@lingui/react/macro";
import type { LegalGraph as Graph, LegalNode, LegalNodeKind } from "@rakazo/contracts";
import { cn } from "@rakazo/ui-web";
import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { DATA_ROOM_PATH } from "../../lib/data-room";
import { maskCurrencyWhenHidden, useHideAmounts } from "../../lib/hide-amounts-preference";

/** Most nodes drawn; past this the busiest ones are kept and a note says so. */
export const MAX_GRAPH_NODES = 120;

// Left to right; contracts sit in the middle, the entities they bind on the left, what they say on the right.
const COLUMN_ORDER: LegalNodeKind[] = [
  "company",
  "person",
  "jurisdiction",
  "contract",
  "obligation",
  "right",
  "asset",
  "other",
];
const COLUMN_W = 180;
const ROW = 30;
const PAD = 24;
const NODE_W = 164;
const NODE_H = 22;

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

const short = (label: string) => (label.length > 27 ? `${label.slice(0, 26)}…` : label);

type Placed = { node: LegalNode; x: number; y: number };

/**
 * ponytail: simple column layout, one column per node kind, in a fixed order, no edge routing.
 * Upgrade to a force-directed or layered layout (and edge labels) once graphs routinely cross
 * a few hundred edges and the straight lines stop being readable.
 */
function layout(graph: Graph) {
  const degree = new Map<string, number>();
  for (const edge of graph.edges) {
    degree.set(edge.fromId, (degree.get(edge.fromId) ?? 0) + 1);
    degree.set(edge.toId, (degree.get(edge.toId) ?? 0) + 1);
  }
  const hidden = Math.max(0, graph.nodes.length - MAX_GRAPH_NODES);
  const kept =
    hidden === 0
      ? graph.nodes
      : [...graph.nodes]
          .sort((a, b) => (degree.get(b.id) ?? 0) - (degree.get(a.id) ?? 0))
          .slice(0, MAX_GRAPH_NODES);
  const columns = COLUMN_ORDER.map((kind) => kept.filter((node) => node.kind === kind)).filter(
    (column) => column.length > 0,
  );
  const width = Math.max(720, columns.length * COLUMN_W);
  const step = width / columns.length;
  const rows = Math.max(1, ...columns.map((column) => column.length));
  const height = PAD * 2 + 20 + rows * ROW;
  const placed = new Map<string, Placed>();
  columns.forEach((column, c) => {
    const top = PAD + 20 + ((rows - column.length) * ROW) / 2;
    column.forEach((node, r) => {
      placed.set(node.id, { node, x: step * (c + 0.5), y: top + r * ROW + ROW / 2 });
    });
  });
  const heads = columns.map((column, c) => ({ kind: column[0]?.kind, x: step * (c + 0.5) }));
  const edges = graph.edges.filter((edge) => placed.has(edge.fromId) && placed.has(edge.toId));
  return { placed, edges, heads, width, height, hidden };
}

/** Nodes and edges as an SVG diagram. Selecting a node highlights its edges and lists its relations below. */
export function LegalGraphView({ graph }: { graph: Graph }) {
  useHideAmounts();
  const [selected, setSelected] = useState<string | null>(null);
  const { placed, edges, heads, width, height, hidden } = useMemo(() => layout(graph), [graph]);
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
  const selectedLabel = selectedNode?.label ?? "";
  const shown = Math.min(graph.nodes.length, MAX_GRAPH_NODES);
  const total = graph.nodes.length;
  const labelOf = (nodeId: string) => placed.get(nodeId)?.node.label ?? "";
  return (
    <div className="flex flex-col gap-3">
      {hidden > 0 ? (
        <p className="text-xs text-muted-foreground">
          <Trans>
            Showing the {shown} most connected of {total} items.
          </Trans>
        </p>
      ) : null}
      <div className="overflow-x-auto rounded-xl border border-border bg-card">
        {/* biome-ignore lint/a11y/useSemanticElements: an SVG cannot be a fieldset */}
        <svg
          role="group"
          aria-label={t`Legal relationships`}
          viewBox={`0 0 ${width} ${height}`}
          className="w-full min-w-[640px]"
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
                d={`M${from.x} ${from.y} C${(from.x + to.x) / 2} ${from.y} ${(from.x + to.x) / 2} ${to.y} ${to.x} ${to.y}`}
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
              aria-label={`${kindName(node.kind)}: ${node.label}`}
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
                y={y + 4}
                textAnchor="middle"
                className={cn(
                  "fill-foreground text-[11px]",
                  node.kind === "contract" && "font-medium",
                )}
              >
                {short(node.label)}
              </text>
            </g>
          ))}
        </svg>
      </div>
      {selectedNode ? (
        <section aria-label={t`Relations of ${selectedLabel}`} className="text-sm">
          <h3 className="mb-1 font-medium">{selectedNode.label}</h3>
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
