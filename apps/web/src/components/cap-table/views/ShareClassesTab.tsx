import { t } from "@lingui/core/macro";
import type { EquityOverview, EquityShareClass } from "@rakazo/contracts";
import {
  Badge,
  Button,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  enqueueNotificationToast,
  Label,
  NativeSelect,
  NativeSelectOption,
  Skeleton,
  Switch,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableHeadRow,
  TableRow,
} from "@rakazo/ui-web";
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { rpc } from "../../../lib/rpc";
import { errorText } from "../../../lib/user-error";
import { CapTableEmptyState } from "../shell/CapTableEmptyState";
import { formatPrice, formatShares } from "./format";
import { ShareClassForm } from "./ShareClassForm";

const yesNo = (value: boolean) => (value ? t`Yes` : t`No`);
const money = (value: string | null) => (value == null ? "—" : formatPrice(value));

/** Share classes with their terms as of an incorporation document date; create and edit terms. */
export function ShareClassesTab() {
  const [classes, setClasses] = useState<EquityShareClass[] | null>(null);
  const [dates, setDates] = useState<string[]>([]);
  const [asOfDocumentDate, setAsOfDocumentDate] = useState("");
  const [outstanding, setOutstanding] = useState<Map<string, string>>(new Map());
  const [error, setError] = useState("");
  const [editing, setEditing] = useState<EquityShareClass | "new" | null>(null);
  const [reloadCount, setReloadCount] = useState(0);
  const [allTerms, setAllTerms] = useState(false);

  useEffect(() => {
    let live = true;
    setError("");
    Promise.all([
      rpc.equity.shareClasses.list({
        pageSize: 100,
        sort: { field: "seniority", dir: "asc" },
        ...(asOfDocumentDate ? { asOfDocumentDate } : {}),
      }),
      rpc.equity.overview({}),
    ])
      .then(([page, overview]: [{ items: EquityShareClass[] }, EquityOverview]) => {
        if (!live) return;
        setClasses(page.items);
        if (!asOfDocumentDate)
          setDates(
            [...new Set(page.items.flatMap((row) => row.versions.map((v) => v.documentDate)))]
              .sort()
              .reverse(),
          );
        setOutstanding(
          new Map(overview.classes.map((row) => [row.shareClassId, row.outstandingShares])),
        );
      })
      .catch((cause: unknown) => {
        if (live) setError(errorText(cause));
      });
    return () => {
      live = false;
    };
  }, [asOfDocumentDate, reloadCount]);

  const overIssued = useMemo(
    () =>
      new Set(
        (classes ?? [])
          .filter(
            (row) => BigInt(outstanding.get(row.id) ?? "0") > BigInt(row.current.authorizedShares),
          )
          .map((row) => row.id),
      ),
    [classes, outstanding],
  );

  const saved = (shareClass: EquityShareClass) => {
    setEditing(null);
    enqueueNotificationToast({
      id: `share-class-${shareClass.id}`,
      title: t`Saved ${shareClass.name}`,
    });
    setReloadCount((count) => count + 1);
  };

  if (error)
    return (
      <div role="alert" className="flex flex-wrap items-center gap-3 text-sm">
        <span className="text-destructive">{error}</span>
        <Button variant="outline" size="sm" onClick={() => setReloadCount((count) => count + 1)}>
          {t`Try again`}
        </Button>
      </div>
    );
  if (classes == null) return <Skeleton className="h-40 w-full" />;

  const newButton = (
    <Button size="sm" onClick={() => setEditing("new")}>
      {t`New share class`}
    </Button>
  );
  return (
    <div className="flex flex-col gap-4">
      {classes.length === 0 && !asOfDocumentDate ? (
        <CapTableEmptyState message={t`No share classes yet`} action={newButton} />
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-3">
            <NativeSelect
              aria-label={t`Terms as of`}
              value={asOfDocumentDate}
              onChange={(event) => setAsOfDocumentDate(event.target.value)}
            >
              <NativeSelectOption value="">{t`Latest terms`}</NativeSelectOption>
              {dates.map((date) => (
                <NativeSelectOption key={date} value={date}>
                  {date}
                </NativeSelectOption>
              ))}
            </NativeSelect>
            <Label className="gap-2 font-normal">
              <Switch checked={allTerms} onCheckedChange={setAllTerms} />
              {t`All terms`}
            </Label>
            <div className="ms-auto">{newButton}</div>
          </div>
          <div className="overflow-x-auto">
            <Table compact className="whitespace-nowrap">
              <TableHeader>
                <TableHeadRow>
                  <TableHead>{t`Name`}</TableHead>
                  <TableHead>{t`Prefix`}</TableHead>
                  <TableHead className="text-end">{t`Authorized`}</TableHead>
                  <TableHead className="text-end">{t`Outstanding`}</TableHead>
                  <TableHead>{t`Class type`}</TableHead>
                  {allTerms ? (
                    <TableHead className="text-end">{t`Votes per share`}</TableHead>
                  ) : null}
                  {allTerms ? <TableHead>{t`Certificated`}</TableHead> : null}
                  {allTerms ? <TableHead className="text-end">{t`Par value`}</TableHead> : null}
                  <TableHead className="text-end">{t`Seniority`}</TableHead>
                  {allTerms ? <TableHead>{t`Pari passu`}</TableHead> : null}
                  <TableHead className="text-end">{t`Original issue price`}</TableHead>
                  {allTerms ? (
                    <TableHead className="text-end">{t`Conversion price`}</TableHead>
                  ) : null}
                  {allTerms ? (
                    <TableHead className="text-end">{t`Conversion ratio`}</TableHead>
                  ) : null}
                  <TableHead className="text-end">{t`Liquidation multiple`}</TableHead>
                  <TableHead>{t`Participating`}</TableHead>
                  <TableHead>
                    <span className="sr-only">{t`Actions`}</span>
                  </TableHead>
                </TableHeadRow>
              </TableHeader>
              <TableBody aria-label={t`Share classes`}>
                {classes.map((row) => {
                  const terms = row.current;
                  const preferred = row.classType === "preferred";
                  return (
                    <TableRow key={row.id}>
                      <TableCell className="font-medium">{row.name}</TableCell>
                      <TableCell>{row.prefix}</TableCell>
                      <TableCell className="text-end tabular-nums">
                        {formatShares(terms.authorizedShares)}
                      </TableCell>
                      <TableCell className="text-end tabular-nums">
                        <span className="inline-flex items-center gap-2">
                          {overIssued.has(row.id) ? (
                            <Badge variant="destructive">{t`Over authorized`}</Badge>
                          ) : null}
                          {formatShares(outstanding.get(row.id) ?? "0")}
                        </span>
                      </TableCell>
                      <TableCell>{preferred ? t`Preferred` : t`Common`}</TableCell>
                      {allTerms ? (
                        <TableCell className="text-end tabular-nums">
                          {terms.votesPerShare}
                        </TableCell>
                      ) : null}
                      {allTerms ? <TableCell>{yesNo(terms.certificated)}</TableCell> : null}
                      {allTerms ? (
                        <TableCell className="text-end tabular-nums">
                          {money(terms.parValue)}
                        </TableCell>
                      ) : null}
                      <TableCell className="text-end tabular-nums">{terms.seniority}</TableCell>
                      {allTerms ? <TableCell>{yesNo(terms.pariPassu)}</TableCell> : null}
                      <TableCell className="text-end tabular-nums">
                        {preferred ? money(terms.originalIssuePrice) : "—"}
                      </TableCell>
                      {allTerms ? (
                        <TableCell className="text-end tabular-nums">
                          {preferred ? money(terms.conversionPrice) : "—"}
                        </TableCell>
                      ) : null}
                      {allTerms ? (
                        <TableCell className="text-end tabular-nums">
                          {preferred ? terms.conversionRatio : "—"}
                        </TableCell>
                      ) : null}
                      <TableCell className="text-end tabular-nums">
                        {preferred ? `${terms.multiplier}×` : "—"}
                      </TableCell>
                      <TableCell>{preferred ? yesNo(terms.participating) : "—"}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <Button variant="ghost" size="sm" onClick={() => setEditing(row)}>
                            {t`Edit terms`}
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            render={<Link to={`/app/cap-table/securities?class=${row.id}`} />}
                          >
                            {t`Convert shares`}
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </>
      )}
      <Dialog open={editing != null} onOpenChange={(open) => !open && setEditing(null)}>
        <DialogContent className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>
              {editing === "new" || editing == null ? t`New share class` : editing.name}
            </DialogTitle>
          </DialogHeader>
          {editing != null ? (
            <ShareClassForm
              shareClass={editing === "new" ? undefined : editing}
              onSaved={saved}
              onCancel={() => setEditing(null)}
            />
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}
