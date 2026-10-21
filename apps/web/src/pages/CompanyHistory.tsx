import { t } from "@lingui/core/macro";
import { Trans } from "@lingui/react/macro";
import type { CompanyFact, CompanyPageData } from "@rakazo/contracts";
import type { CompanyHistoryStream, CompanyHistoryZoom } from "@rakazo/core";
import { companyHistoryItems, layoutCompanyHistory } from "@rakazo/core";
import { Button } from "@rakazo/ui-web";
import { useEffect, useRef, useState } from "react";
import { companyDate } from "../lib/company-format";
import { maskCurrencyWhenHidden, useHideAmounts } from "../lib/hide-amounts-preference";
import { todayIso } from "../lib/legal-format";

export function CompanyHistory({
  data,
  onOpen,
  initialZoom = "year",
  today = todayIso(),
}: {
  data: CompanyPageData;
  onOpen: (fact: CompanyFact) => void;
  initialZoom?: CompanyHistoryZoom;
  today?: string;
}) {
  useHideAmounts();
  const [zoom, setZoom] = useState(initialZoom);
  const pointers = useRef(new Map<number, number>());
  const pinch = useRef<number | null>(null);
  const dragged = useRef(false);
  const viewport = useRef<HTMLElement>(null);
  useEffect(() => {
    const element = viewport.current;
    if (!element) return;
    const wheel = (event: WheelEvent) => {
      if (!event.ctrlKey) return;
      event.preventDefault();
      const steps: CompanyHistoryZoom[] = ["year", "quarter", "month"];
      setZoom(
        (current) =>
          steps[Math.max(0, Math.min(2, steps.indexOf(current) + (event.deltaY < 0 ? 1 : -1)))]!,
      );
    };
    element.addEventListener("wheel", wheel, { passive: false });
    return () => element.removeEventListener("wheel", wheel);
  }, [data]);
  const levels: CompanyHistoryZoom[] = ["year", "quarter", "month"];
  const changeZoom = (direction: number) =>
    setZoom((current) => levels[Math.max(0, Math.min(2, levels.indexOf(current) + direction))]!);
  const items = companyHistoryItems(data);
  const layout = layoutCompanyHistory(items, zoom, today);
  const labels: Record<CompanyHistoryStream, string> = {
    company: t`Company`,
    people: t`People`,
    funding: t`Funding`,
    legal: t`Legal`,
    product: t`Product`,
    customers: t`Customers`,
  };
  function open(kind: "entity" | "edge" | "event", id: string) {
    if (kind === "entity") {
      const record = data.entities.find((row) => row.id === id);
      if (record) onOpen({ kind, record });
    }
    if (kind === "edge") {
      const record = data.edges.find((row) => row.id === id);
      if (record) onOpen({ kind, record });
    }
    if (kind === "event") {
      const record = data.events.find((row) => row.id === id);
      if (record) onOpen({ kind, record });
    }
  }
  return (
    <section aria-label={t`History`} className="space-y-3">
      <fieldset className="flex gap-1 border-0 p-0">
        <legend className="sr-only">
          <Trans>History zoom</Trans>
        </legend>
        {levels.map((level) => (
          <Button
            key={level}
            variant={level === zoom ? "secondary" : "ghost"}
            aria-pressed={level === zoom}
            onClick={() => setZoom(level)}
          >
            {level === "year" ? (
              <Trans>Year</Trans>
            ) : level === "quarter" ? (
              <Trans>Quarter</Trans>
            ) : (
              <Trans>Month</Trans>
            )}
          </Button>
        ))}
      </fieldset>
      {!items.length ? (
        <p className="text-sm text-muted-foreground">
          <Trans>No dated facts</Trans>
        </p>
      ) : (
        <section
          ref={viewport}
          className="overflow-auto rounded border focus-visible:outline-2 focus-visible:outline-ring"
          aria-label={t`History timeline; plus or minus to zoom`}
          onKeyDown={(event) => {
            if (event.key === "+" || event.key === "=" || event.key === "-") {
              event.preventDefault();
              changeZoom(event.key === "-" ? -1 : 1);
            }
          }}
          onPointerDown={(event) => {
            if (pointers.current.size === 0) dragged.current = false;
            if (event.pointerType !== "touch") return;
            pointers.current.set(event.pointerId, event.clientX);
            if (pointers.current.size === 2)
              for (const id of pointers.current.keys()) event.currentTarget.setPointerCapture(id);
          }}
          onPointerMove={(event) => {
            if (!pointers.current.has(event.pointerId)) return;
            const previous = pointers.current.get(event.pointerId)!;
            pointers.current.set(event.pointerId, event.clientX);
            const values = [...pointers.current.values()];
            if (values.length === 1) {
              const delta = previous - event.clientX;
              event.currentTarget.scrollLeft += delta;
              if (Math.abs(delta) > 3) dragged.current = true;
              return;
            }
            if (values.length !== 2) return;
            dragged.current = true;
            const distance = Math.abs(values[0]! - values[1]!);
            if (pinch.current !== null && Math.abs(distance - pinch.current) > 40) {
              changeZoom(distance > pinch.current ? 1 : -1);
              pinch.current = distance;
            } else if (pinch.current === null) pinch.current = distance;
          }}
          onPointerUp={(event) => {
            pointers.current.delete(event.pointerId);
            pinch.current = null;
          }}
          onPointerCancel={(event) => {
            pointers.current.delete(event.pointerId);
            pinch.current = null;
          }}
          style={{ touchAction: "pan-y" }}
        >
          <svg width={layout.width} height={layout.height} aria-label={t`Company history`}>
            <title>{t`Company history`}</title>
            {layout.ticks.map((tick) => (
              <g key={tick.label}>
                <line
                  x1={tick.x}
                  x2={tick.x}
                  y1={28}
                  y2={layout.height}
                  className="stroke-border"
                />
                <text x={tick.x + 4} y={20} className="fill-muted-foreground text-xs">
                  {tick.label}
                </text>
              </g>
            ))}
            {layout.lanes.map((lane) => (
              <g key={lane.stream}>
                <line x1={0} x2={layout.width} y1={lane.y} y2={lane.y} className="stroke-border" />
                <text x={10} y={lane.y + 24} className="fill-muted-foreground text-xs">
                  {labels[lane.stream]}
                </text>
                {lane.items.map((item) => {
                  const name = maskCurrencyWhenHidden(item.title);
                  const date = `${companyDate(item.start)}${item.period ? ` — ${item.end ? companyDate(item.end) : t`Ongoing`}` : ""}`;
                  const label = `${name} · ${date}${item.status !== "confirmed" ? ` · ${t`Not confirmed`}` : ""}`;
                  return (
                    // biome-ignore lint/a11y/useSemanticElements: SVG groups cannot contain HTML buttons
                    <g
                      key={`${item.kind}:${item.id}`}
                      role="button"
                      tabIndex={0}
                      aria-label={label}
                      className="group cursor-pointer text-foreground outline-none"
                      onClick={() => {
                        if (!dragged.current) open(item.kind, item.id);
                        dragged.current = false;
                      }}
                      onKeyDown={(event) => {
                        if (event.key === "Enter" || event.key === " ") {
                          event.preventDefault();
                          open(item.kind, item.id);
                        }
                      }}
                    >
                      <title>{label}</title>
                      <rect
                        x={item.x - 4}
                        y={item.y - 12}
                        width={Math.max(220, item.width) + 8}
                        height={52}
                        rx={4}
                        className="fill-transparent stroke-transparent group-focus:stroke-ring"
                      />
                      {item.marker ? (
                        <circle cx={item.x + 4} cy={item.y} r={5} fill="currentColor" />
                      ) : (
                        <rect
                          x={item.x}
                          y={item.y - 5}
                          width={item.width}
                          height={10}
                          rx={2}
                          fill="currentColor"
                          opacity={item.uncertain ? 0.3 : 0.7}
                        />
                      )}
                      <text x={item.x} y={item.y + 20} className="fill-foreground text-xs">
                        {name.length > 30 ? `${name.slice(0, 29)}…` : name}
                      </text>
                      {item.status !== "confirmed" && (
                        <text x={item.x} y={item.y + 34} className="fill-muted-foreground text-xs">
                          {t`Not confirmed`}
                        </text>
                      )}
                    </g>
                  );
                })}
              </g>
            ))}
          </svg>
        </section>
      )}
    </section>
  );
}
