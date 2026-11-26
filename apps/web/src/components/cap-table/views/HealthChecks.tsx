import { t } from "@lingui/core/macro";
import type { EquityHealthFinding } from "@rakazo/contracts";
import { toCsv } from "@rakazo/core/equity";
import { Badge, Button, Skeleton, Tabs, TabsList, TabsTrigger } from "@rakazo/ui-web";
import { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { todayIso } from "../../../lib/legal-format";
import { rpc } from "../../../lib/rpc";
import { errorText } from "../../../lib/user-error";
import { downloadText } from "./download";
import { recordHref } from "./links";

type Row = { recordKind: string; recordId: string; name: string; detail: string };
type View = "required" | "recommended" | "dismissed";

const TITLES = (): Record<string, string> => ({
  "class-over-issued": t`Share class issued over its authorized shares`,
  "options-above-pool": t`Options granted above the pool`,
  "security-missing-data": t`Security missing its shares or date`,
  "holder-missing-email": t`Holder without an email`,
  "duplicated-stakeholder": t`Duplicated stakeholder`,
  share_class_version_mismatch: t`Share class versions don't match filing dates`,
});

/** Health checks: problems found in the ledger, by severity, each row linking to its record. */
/** A check key no title is known for, as words: "some_check-key" -> "Some check key". */
function readableCheck(key: string): string {
  const words = key.replace(/[_-]+/g, " ").trim();
  return words.charAt(0).toUpperCase() + words.slice(1);
}

/** The detail every row of a finding shares (e.g. one duplicated email), shown once; else null. */
function sharedDetail(rows: Row[]): string | null {
  const first = rows[0]?.detail;
  return rows.length > 1 && first && rows.every((row) => row.detail === first) ? first : null;
}

const TAGS = (): Record<string, string> => ({
  share_classes: t`Share classes`,
  company: t`Company`,
  securities: t`Securities`,
  documents: t`Documents`,
  stakeholder: t`Stakeholder`,
});

const TAG_KEYS = ["share_classes", "company", "securities", "documents", "stakeholder"] as const;

export function HealthChecks({ today = todayIso() }: { today?: string }) {
  const [findings, setFindings] = useState<EquityHealthFinding[] | null>(null);
  const [view, setView] = useState<View>("required");
  const [tags, setTags] = useState<ReadonlySet<string>>(new Set(TAG_KEYS));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const opened = useRef(false);

  const load = useCallback(async () => {
    const page = await rpc.equity.healthFindings.list({
      pageSize: 200,
      status: ["open", "dismissed"],
    });
    setFindings(page.items);
    // Open on the severity that has work in it, once; later reloads keep the user's choice.
    if (!opened.current) {
      opened.current = true;
      const open = page.items.filter((finding: EquityHealthFinding) => finding.status === "open");
      if (!open.some((finding) => finding.severity === "required") && open.length > 0)
        setView("recommended");
    }
  }, []);

  useEffect(() => {
    load().catch((cause: unknown) => setError(errorText(cause)));
  }, [load]);

  const act = async (fn: () => Promise<unknown>) => {
    setBusy(true);
    setError("");
    try {
      await fn();
      await load();
    } catch (cause) {
      setError(errorText(cause));
    } finally {
      setBusy(false);
    }
  };

  if (findings == null && !error) return <Skeleton className="h-24 w-full" />;
  const titles = TITLES();
  const tagNames = TAGS();
  const all = findings ?? [];
  const inTags = all.filter((finding) => tags.has(finding.tag));
  const shown = inTags.filter((finding) =>
    view === "dismissed"
      ? finding.status === "dismissed"
      : finding.status === "open" && finding.severity === view,
  );
  const count = (severity: string) =>
    inTags.filter((finding) => finding.status === "open" && finding.severity === severity).length;

  const toggleTag = (key: string) =>
    setTags((current) => {
      const next = new Set(current);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });

  const exportCsv = () => {
    const rows = shown.flatMap((finding) =>
      (finding.rows as Row[]).map((row) => ({
        check: titles[finding.check] ?? readableCheck(finding.check),
        tag: tagNames[finding.tag] ?? finding.tag,
        severity: finding.severity,
        status: finding.status,
        record: row.name,
        detail: row.detail,
      })),
    );
    downloadText(
      `health-checks-${today}.csv`,
      toCsv(
        [
          { key: "check", label: t`Check` },
          { key: "tag", label: t`Tag` },
          { key: "severity", label: t`Severity` },
          { key: "status", label: t`Status` },
          { key: "record", label: t`Record` },
          { key: "detail", label: t`Detail` },
        ],
        rows,
      ),
    );
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-3">
        <Tabs value={view} onValueChange={(value) => setView(value as View)}>
          <TabsList>
            <TabsTrigger value="required">{t`Required (${count("required")})`}</TabsTrigger>
            <TabsTrigger value="recommended">{t`Recommended (${count("recommended")})`}</TabsTrigger>
            <TabsTrigger value="dismissed">{t`Dismissed`}</TabsTrigger>
          </TabsList>
        </Tabs>
        <Button
          className="ms-auto"
          variant="outline"
          size="sm"
          disabled={busy || shown.length === 0}
          onClick={exportCsv}
        >
          {t`Export results`}
        </Button>
        <Button
          variant="outline"
          size="sm"
          disabled={busy}
          onClick={() => void act(() => rpc.equity.views.runHealthChecks())}
        >
          {t`Rerun checks`}
        </Button>
      </div>
      <fieldset
        aria-label={t`Filter tags`}
        className="flex flex-wrap items-center gap-2 border-0 p-0"
      >
        {TAG_KEYS.map((key) => {
          const on = tags.has(key);
          return (
            <Badge
              key={key}
              variant={on ? "default" : "outline"}
              render={
                <button
                  type="button"
                  aria-pressed={on}
                  onClick={() => toggleTag(key)}
                  className="cursor-pointer"
                />
              }
            >
              {tagNames[key]}
            </Badge>
          );
        })}
      </fieldset>
      {error ? (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      ) : null}
      {shown.length === 0 ? (
        <p className="py-4 text-center text-sm text-muted-foreground">{t`Nothing to fix`}</p>
      ) : (
        <ul className="flex flex-col gap-3" aria-label={t`Health checks`}>
          {shown.map((finding) => (
            <li key={finding.id} className="rounded-lg border p-3">
              <div className="flex items-center gap-2">
                <Badge variant={finding.severity === "required" ? "destructive" : "secondary"}>
                  {tagNames[finding.tag] ?? finding.tag}
                </Badge>
                <span className="font-medium">
                  {titles[finding.check] ?? readableCheck(finding.check)}
                </span>
                <Button
                  className="ms-auto"
                  variant="ghost"
                  size="sm"
                  disabled={busy}
                  onClick={() =>
                    void act(() => rpc.equity.views.runHealthChecks({ check: finding.check }))
                  }
                >
                  {t`Rerun check`}
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={busy}
                  onClick={() =>
                    void act(() =>
                      rpc.equity.healthFindings.update({
                        id: finding.id,
                        status: finding.status === "dismissed" ? "open" : "dismissed",
                      }),
                    )
                  }
                >
                  {finding.status === "dismissed" ? t`Restore` : t`Dismiss`}
                </Button>
              </div>
              <ul className="mt-2 flex flex-col gap-1 text-sm">
                {(finding.rows as Row[]).map((row) => (
                  <li key={row.recordId} className="flex gap-3">
                    <Link
                      className="font-medium underline-offset-4 hover:underline"
                      to={recordHref(row.recordKind, row.recordId)}
                    >
                      {row.name}
                    </Link>
                    {sharedDetail(finding.rows as Row[]) ? null : (
                      <span className="text-muted-foreground">{row.detail}</span>
                    )}
                  </li>
                ))}
                {sharedDetail(finding.rows as Row[]) ? (
                  <li className="text-muted-foreground">{sharedDetail(finding.rows as Row[])}</li>
                ) : null}
              </ul>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
