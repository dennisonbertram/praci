import { maskCurrencyText } from "@rakazo/chat-ui/mask-currency";
import { ChatMarkdown } from "@rakazo/chat-ui/web";
import type { UiBlock } from "@rakazo/contracts";
import {
  Badge,
  Card,
  Separator,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableHeadRow,
  TableRow,
} from "@rakazo/ui-web";
import { cn } from "@rakazo/ui-web/lib/utils";
import { ChevronRight, CircleCheck, Info, OctagonAlert, TriangleAlert } from "lucide-react";
import type { ReactNode } from "react";
import { useEffect, useRef, useState } from "react";
import { useHideAmounts } from "../lib/hide-amounts-preference";

type Props = {
  block: UiBlock;
  /** Opens an in-app path through the router; without it app links load normally. */
  onNavigate?: (href: string) => void;
};

const TONES = {
  info: { icon: Info, box: "border-border bg-muted/50", mark: "text-muted-foreground" },
  success: { icon: CircleCheck, box: "border-success/40 bg-success/10", mark: "text-success" },
  warning: { icon: TriangleAlert, box: "border-warning/40 bg-warning/10", mark: "text-warning" },
  danger: {
    icon: OctagonAlert,
    box: "border-destructive/40 bg-destructive/10",
    mark: "text-destructive",
  },
} as const;

/** Scrolls sideways; the right edge fades while more is hidden, so a cut-off column reads as "scroll". */
function SideScroll({ children }: { children: ReactNode }) {
  const box = useRef<HTMLDivElement>(null);
  const [more, setMore] = useState(false);
  const measure = () => {
    const el = box.current;
    if (el) setMore(el.scrollWidth - el.clientWidth - Math.abs(el.scrollLeft) > 1);
  };
  // biome-ignore lint/correctness/useExhaustiveDependencies: measure only reads the box; it runs once the table has rendered.
  useEffect(measure, []);
  return (
    <div
      ref={box}
      onScroll={measure}
      className={cn("overflow-x-auto px-4", more && "mask-r-from-[calc(100%-2rem)]")}
    >
      {children}
    </div>
  );
}

/** A typed block from the render_ui tool. All text is plain or Markdown; nothing here runs model code. */
export function UiBlockView({ block, onNavigate }: Props) {
  const hidden = useHideAmounts();
  const text = (value: string | number) => {
    const raw = String(value);
    return hidden ? maskCurrencyText(raw) : raw;
  };
  const markdown = (body: string) => <ChatMarkdown onNavigate={onNavigate}>{body}</ChatMarkdown>;
  const title = (value?: string) =>
    value ? <h3 className="px-4 text-sm font-medium">{value}</h3> : null;

  let content: ReactNode;
  switch (block.type) {
    case "table":
      content = (
        <Card size="sm" className="gap-2">
          {title(block.title)}
          <SideScroll>
            <Table compact>
              <TableHeader>
                <TableHeadRow>
                  {block.columns.map((column, c) => (
                    <TableHead
                      key={c}
                      className={cn("whitespace-nowrap", column.align === "right" && "text-end")}
                    >
                      {column.label}
                    </TableHead>
                  ))}
                </TableHeadRow>
              </TableHeader>
              <TableBody>
                {block.rows.map((row, r) => (
                  <TableRow key={r} className="h-auto">
                    {row.map((cell, c) => (
                      <TableCell
                        key={c}
                        className={cn(
                          "align-top",
                          // Short values stay on one line and the table scrolls; long text wraps.
                          String(cell).length <= 24 ? "whitespace-nowrap" : "max-w-80 min-w-48",
                          block.columns[c]?.align === "right" && "text-end tabular-nums",
                        )}
                      >
                        {text(cell)}
                      </TableCell>
                    ))}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </SideScroll>
        </Card>
      );
      break;
    case "sections":
      content = (
        <Card size="sm" className="gap-0 py-0">
          {block.sections.map((section, i) => (
            <section key={i} aria-label={section.heading}>
              {i > 0 ? <Separator /> : null}
              <div className="flex flex-col gap-1 px-4 py-3">
                <h3 className="text-sm font-medium">{section.heading}</h3>
                {markdown(section.body)}
              </div>
            </section>
          ))}
        </Card>
      );
      break;
    case "summary":
      content = (
        <Card size="sm" className="gap-2">
          {title(block.title)}
          <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-1.5 px-4">
            {block.items.map((item, i) => (
              <div key={i} className="col-span-2 grid grid-cols-subgrid">
                <dt className="text-muted-foreground">{item.label}</dt>
                <dd className="min-w-0 text-end font-medium break-words tabular-nums">
                  {text(item.value)}
                </dd>
              </div>
            ))}
          </dl>
        </Card>
      );
      break;
    case "stats":
      content = (
        <dl className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {block.stats.map((stat, i) => (
            <div
              key={i}
              className="min-w-0 rounded-xl bg-muted/50 px-3 py-2.5 ring-1 ring-foreground/10"
            >
              <dt className="truncate text-xs text-muted-foreground">{stat.label}</dt>
              <dd className="truncate text-xl font-semibold tabular-nums">{text(stat.value)}</dd>
              {stat.hint ? (
                <dd className="truncate text-xs text-muted-foreground">{text(stat.hint)}</dd>
              ) : null}
            </div>
          ))}
        </dl>
      );
      break;
    case "cards":
      content = (
        <ul className="grid gap-2 sm:grid-cols-2">
          {block.cards.map((card, i) => {
            const external = card.href?.startsWith("https://");
            return (
              <li key={i} className="min-w-0">
                <Card
                  size="sm"
                  className={cn("relative h-full gap-1 px-4", card.href && "hover:bg-accent/50")}
                >
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="min-w-0 text-sm font-medium break-words">
                      {card.href ? (
                        <a
                          href={card.href}
                          // The link's hit area covers the whole card.
                          className="underline-offset-4 after:absolute after:inset-0 hover:underline"
                          {...(external
                            ? { target: "_blank", rel: "noopener noreferrer" }
                            : {
                                onClick: (event) => {
                                  if (!onNavigate || event.metaKey || event.ctrlKey) return;
                                  event.preventDefault();
                                  onNavigate(card.href as string);
                                },
                              })}
                        >
                          {card.title}
                        </a>
                      ) : (
                        card.title
                      )}
                    </h3>
                    {card.badge ? <Badge variant="secondary">{card.badge}</Badge> : null}
                    {card.href ? (
                      <ChevronRight
                        aria-hidden="true"
                        className="mt-0.5 size-4 shrink-0 text-muted-foreground"
                      />
                    ) : null}
                  </div>
                  {card.subtitle ? (
                    <p className="text-xs text-muted-foreground">{text(card.subtitle)}</p>
                  ) : null}
                  {card.body ? (
                    // Links in the body sit above the card-wide link.
                    <div className="[&_a]:relative [&_a]:z-10">{markdown(card.body)}</div>
                  ) : null}
                </Card>
              </li>
            );
          })}
        </ul>
      );
      break;
    case "callout": {
      const tone = TONES[block.tone];
      const Icon = tone.icon;
      content = (
        <div className={cn("flex gap-2.5 rounded-xl border px-3.5 py-3 text-sm", tone.box)}>
          <Icon aria-hidden="true" className={cn("mt-0.5 size-4 shrink-0", tone.mark)} />
          <div className="min-w-0 flex-1">
            {block.title ? <h3 className="font-medium">{block.title}</h3> : null}
            {markdown(block.body)}
          </div>
        </div>
      );
      break;
    }
  }
  return (
    <div data-testid="ui-block" className="w-full max-w-2xl min-w-0 py-1">
      {content}
    </div>
  );
}
