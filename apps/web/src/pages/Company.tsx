import { t } from "@lingui/core/macro";
import { Trans } from "@lingui/react/macro";
import type { CompanyEntityRecord, CompanyFact } from "@rakazo/contracts";
import {
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  Skeleton,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  Tabs,
  TabsList,
  TabsTrigger,
} from "@rakazo/ui-web";
import { Ellipsis } from "lucide-react";
import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useFinanceQuery } from "../components/finance/ui";
import { downloadArtifactBytes } from "../lib/artifact-open";
import { companyDate, companyDateEnd } from "../lib/company-format";
import { money } from "../lib/finance-format";
import { maskCurrencyWhenHidden, useHideAmounts } from "../lib/hide-amounts-preference";
import { todayIso } from "../lib/legal-format";
import { rpc } from "../lib/rpc";
import { errorText } from "../lib/user-error";
import { CompanyFactDetail } from "./CompanyFactDetail";
import { CompanyPrivacy } from "./CompanyPrivacy";

export function CompanyPage() {
  useHideAmounts();
  const page = useFinanceQuery(() => rpc.company.page(), []);
  const finance = useFinanceQuery(() => rpc.finance.overview(), []);
  const carta = useFinanceQuery(() => rpc.investors.capTable(), []);
  const [params, setParams] = useSearchParams();
  const view = params.get("view") ?? "overview";
  const [fact, setFact] = useState<CompanyFact | null>(null);
  const [privacy, setPrivacy] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState("");
  async function exportMap() {
    setExporting(true);
    setExportError("");
    try {
      const data = await rpc.company.export();
      downloadArtifactBytes(
        "company-map.json",
        "application/json",
        new TextEncoder().encode(JSON.stringify(data, null, 2)),
      );
    } catch (cause) {
      setExportError(errorText(cause));
    } finally {
      setExporting(false);
    }
  }
  const data = page.data;
  const running =
    data?.latestRun &&
    ["running", "planned", "awaiting_consent", "cancelling"].includes(data.latestRun.status);
  const reload = page.reload;
  useEffect(() => {
    if (!running) return;
    const timer = setInterval(reload, 4000);
    return () => clearInterval(timer);
  }, [running, reload]);
  const people = data?.entities.filter((row) => row.kind === "person") ?? [];
  const organisations = data?.entities.filter((row) => row.kind === "organisation") ?? [];
  const profile = data?.entities.find((row) => row.kind === "company");
  const roles = (id: string) =>
    data?.edges.filter((row) => row.fromId === id && row.relation === "works_at") ?? [];
  const past = (row: CompanyEntityRecord) =>
    roles(row.id).length > 0 &&
    roles(row.id).every((edge) => edge.endsOn && companyDateEnd(edge.endsOn) < todayIso());
  const showEntity = (record: CompanyEntityRecord) => setFact({ kind: "entity", record });
  const rows = (entities: CompanyEntityRecord[]) => (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>
            <Trans>Name</Trans>
          </TableHead>
          <TableHead>
            <Trans>Role</Trans>
          </TableHead>
          <TableHead>
            <Trans>Since</Trans>
          </TableHead>
          <TableHead>
            <Trans>Sources</Trans>
          </TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {entities.map((row) => (
          <TableRow key={row.id}>
            <TableCell>
              <Button variant="link" className="h-auto p-0" onClick={() => showEntity(row)}>
                {maskCurrencyWhenHidden(row.displayName)}
              </Button>
              {row.status !== "confirmed" && (
                <span className="block text-xs text-muted-foreground">
                  <Trans>Not confirmed</Trans>
                </span>
              )}
            </TableCell>
            <TableCell>
              {roles(row.id)
                .filter((edge) => !edge.endsOn || companyDateEnd(edge.endsOn) >= todayIso())
                .map((edge) => (
                  <Button
                    key={edge.id}
                    variant="link"
                    onClick={() => setFact({ kind: "edge", record: edge })}
                  >
                    {maskCurrencyWhenHidden(edge.role ?? "—")}
                  </Button>
                ))}
            </TableCell>
            <TableCell>{companyDate(roles(row.id)[0]?.startsOn)}</TableCell>
            <TableCell>{row.readOnly ? "—" : row.evidence.length}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
  return (
    <div className="rk-scroll flex-1 overflow-y-auto px-4 py-5 md:px-7">
      <header className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">
            <Trans>Company</Trans>
          </h1>
          <p className="text-xs text-muted-foreground">
            <Trans>Reconstructed</Trans>
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Link to="/app/company/import" className="text-sm underline underline-offset-4">
            <Trans>Import</Trans>
          </Link>
          <DropdownMenu>
            <DropdownMenuTrigger
              render={<Button variant="ghost" size="icon" aria-label={t`Company actions`} />}
            >
              <Ellipsis className="size-4" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem disabled={exporting} onClick={() => void exportMap()}>
                <Trans>Export JSON</Trans>
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setPrivacy(true)}>
                <Trans>Privacy</Trans>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </header>
      {exportError && (
        <p role="alert" className="mb-4 text-sm text-destructive">
          {exportError}
        </p>
      )}
      {privacy && <CompanyPrivacy onClose={() => setPrivacy(false)} onChanged={page.reload} />}
      <Tabs value={view} onValueChange={(next) => setParams({ view: String(next) })}>
        <TabsList>
          <TabsTrigger value="overview">
            <Trans>Overview</Trans>
          </TabsTrigger>
          <TabsTrigger value="people">
            <Trans>People</Trans>
          </TabsTrigger>
          <TabsTrigger value="organisations">
            <Trans>Organisations</Trans>
          </TabsTrigger>
        </TabsList>
      </Tabs>
      {page.error && (
        <p role="alert" className="mt-6 text-destructive">
          {page.error}
          <Button variant="link" onClick={reload}>
            <Trans>Retry</Trans>
          </Button>
        </p>
      )}
      {!data && !page.error && <Skeleton className="mt-6 h-64 w-full" />}
      {data && (
        <div className="mt-6 space-y-8">
          {running && (
            <p role="status" className="text-sm text-muted-foreground">
              <Trans>Import in progress</Trans>
            </p>
          )}
          {data.latestRun &&
            ["partial", "paused", "budget_reached", "cancelled", "failed"].includes(
              data.latestRun.status,
            ) && (
              <p role="status" className="text-sm text-muted-foreground">
                <Trans>Partial import</Trans>
              </p>
            )}
          {data.entities.length === 0 && data.events.length === 0 && (
            <div className="py-16 text-center text-muted-foreground">
              <Trans>No company facts yet</Trans>
            </div>
          )}
          {view === "overview" && (data.entities.length > 0 || data.events.length > 0) && (
            <>
              {profile && (
                <section className="space-y-3">
                  <Button
                    variant="link"
                    className="h-auto p-0 text-2xl font-semibold"
                    onClick={() => showEntity(profile)}
                  >
                    {maskCurrencyWhenHidden(profile.displayName)}
                  </Button>
                  <p className="text-muted-foreground">
                    {maskCurrencyWhenHidden(String(profile.attrs.description ?? ""))}
                  </p>
                  {Boolean(profile.attrs.whatWeDo) && (
                    <div className="pt-3">
                      <h2 className="mb-2 font-medium">
                        <Trans>What we do</Trans>
                      </h2>
                      <button
                        type="button"
                        className="text-start"
                        onClick={() => showEntity(profile)}
                      >
                        {maskCurrencyWhenHidden(String(profile.attrs.whatWeDo))}
                      </button>
                      <p className="mt-2 text-xs text-muted-foreground">
                        {profile.evidence.length} <Trans>Sources</Trans>
                      </p>
                    </div>
                  )}
                </section>
              )}
              <div className="grid grid-cols-2 gap-6 border-y py-5 md:grid-cols-4">
                <div>
                  <span className="text-xs text-muted-foreground">
                    <Trans>People</Trans>
                  </span>
                  <p className="text-2xl">{people.length}</p>
                </div>
                <div>
                  <span className="text-xs text-muted-foreground">
                    <Trans>Organisations</Trans>
                  </span>
                  <p className="text-2xl">{organisations.length}</p>
                </div>
                {finance.data?.hasCashAccounts && (
                  <Link to="/app/finance">
                    <span className="text-xs text-muted-foreground">
                      <Trans>Cash</Trans>
                    </span>
                    <p className="text-2xl">{money(finance.data.cash.cashCents)}</p>
                  </Link>
                )}
                {carta.data?.snapshot?.amountRaisedUsd != null && (
                  <Link to="/app/cap-table">
                    <span className="text-xs text-muted-foreground">
                      <Trans>Raised</Trans>
                    </span>
                    <p className="text-2xl">{money(carta.data.snapshot.amountRaisedUsd * 100)}</p>
                  </Link>
                )}
              </div>
              <section>
                <h2 className="mb-3 font-medium">
                  <Trans>Next dates</Trans>
                </h2>
                {data.events
                  .filter((event) => event.occursOn && companyDateEnd(event.occursOn) >= todayIso())
                  .slice(0, 5)
                  .map((event) => (
                    <button
                      type="button"
                      key={event.id}
                      className="flex w-full justify-between border-b py-3 text-start"
                      onClick={() => setFact({ kind: "event", record: event })}
                    >
                      <span>{maskCurrencyWhenHidden(event.title)}</span>
                      <span className="text-muted-foreground">{companyDate(event.occursOn)}</span>
                    </button>
                  ))}
              </section>
              <section>
                <h2 className="mb-3 font-medium">
                  <Trans>Latest events</Trans>
                </h2>
                {data.events
                  .filter((event) => event.occursOn && companyDateEnd(event.occursOn) <= todayIso())
                  .slice(-5)
                  .reverse()
                  .map((event) => (
                    <button
                      type="button"
                      key={event.id}
                      className="flex w-full justify-between border-b py-3 text-start"
                      onClick={() => setFact({ kind: "event", record: event })}
                    >
                      <span>{maskCurrencyWhenHidden(event.title)}</span>
                      <span className="text-muted-foreground">{companyDate(event.occursOn)}</span>
                    </button>
                  ))}
              </section>
            </>
          )}
          {view === "people" && (
            <>
              {rows(people.filter((row) => !past(row)))}
              {people.some(past) && (
                <details>
                  <summary className="cursor-pointer font-medium">
                    <Trans>Past members</Trans>
                  </summary>
                  {rows(people.filter(past))}
                </details>
              )}
            </>
          )}
          {view === "organisations" &&
            [...new Set(organisations.map((row) => String(row.attrs.type ?? "other")))]
              .sort()
              .map((group) => (
                <section key={group}>
                  <h2 className="mb-3 font-medium capitalize">{group.replaceAll("_", " ")}</h2>
                  {organisations
                    .filter((row) => (row.attrs.type ?? "other") === group)
                    .map((row) => (
                      <div key={row.id} className="border-b py-3">
                        <Button
                          variant="link"
                          className="h-auto p-0"
                          onClick={() => showEntity(row)}
                        >
                          {maskCurrencyWhenHidden(row.displayName)}
                        </Button>
                        {data.edges
                          .filter((edge) => edge.fromId === row.id || edge.toId === row.id)
                          .map((edge) => (
                            <Button
                              key={edge.id}
                              variant="ghost"
                              onClick={() => setFact({ kind: "edge", record: edge })}
                            >
                              {edge.relation.replaceAll("_", " ")} · {companyDate(edge.startsOn)} —{" "}
                              {companyDate(edge.endsOn)}
                            </Button>
                          ))}
                      </div>
                    ))}
                </section>
              ))}
        </div>
      )}
      {fact && (
        <CompanyFactDetail
          key={`${fact.kind}:${fact.record.id}`}
          fact={
            fact.kind === "entity"
              ? {
                  ...fact,
                  record: {
                    ...fact.record,
                    edges:
                      data?.edges.filter(
                        (edge) => edge.fromId === fact.record.id || edge.toId === fact.record.id,
                      ) ?? [],
                  },
                }
              : fact
          }
          onClose={() => setFact(null)}
          onChanged={() => {
            setFact(null);
            reload();
          }}
        />
      )}
    </div>
  );
}
