import { t } from "@lingui/core/macro";
import type {
  EquityCustomProperty,
  EquityStakeholder,
  EquityStakeholderDetail,
} from "@rakazo/contracts";
import {
  Badge,
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
  Skeleton,
} from "@rakazo/ui-web";
import { ChevronDown } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { useMatch, useNavigate, useSearchParams } from "react-router-dom";
import { rpc } from "../../../lib/rpc";
import { errorText } from "../../../lib/user-error";
import { CapTableEmptyState } from "../shell/CapTableEmptyState";
import { BulkImportDialog } from "./BulkImportDialog";
import { CustomPropertiesDialog } from "./CustomPropertiesDialog";
import { DatedPropertiesDialog } from "./DatedPropertiesDialog";
import { MergeDialog } from "./MergeDialog";
import { SavedViewsMenu } from "./SavedViewsMenu";
import { StakeholderChanges } from "./StakeholderChanges";
import { StakeholderFilters } from "./StakeholderFilters";
import { StakeholderFormDialog } from "./StakeholderFormDialog";
import { relationshipLabel, StakeholderProfile } from "./StakeholderProfile";
import { StakeholdersTable } from "./StakeholdersTable";
import { downloadText, toCsv } from "./stakeholder-csv";
import { readFilters, writeFilters } from "./stakeholder-filter-params";
import { TerminateDialog } from "./TerminateDialog";

const BASE = "/app/cap-table/stakeholders";

const cell = (value: string | null | undefined) => {
  const text = value ?? "";
  return /[",\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
};

/** The contact spreadsheet: one row per stakeholder. */
export function contactCsv(rows: EquityStakeholder[]): string {
  const header = [
    "Name",
    "Type",
    "Contact email",
    "Relationship",
    "Job title",
    "Cost center",
    "Employee ID",
    "Country",
    "City",
  ];
  return [
    header.join(","),
    ...rows.map((row) =>
      [
        row.name,
        row.type,
        row.contactEmail,
        row.relationship,
        row.jobTitle,
        row.costCenter,
        row.employeeId,
        row.addresses[0]?.country,
        row.addresses[0]?.city,
      ]
        .map(cell)
        .join(","),
    ),
  ].join("\n");
}

/** Every terminated stakeholder with the date and the relationship they left. */
export function terminationsCsv(rows: EquityStakeholder[]): string {
  return toCsv([
    ["Name", "Employee ID", "Termination date", "Relationship"],
    ...rows
      .filter((row) => row.terminatedOn)
      .sort((a, b) => (b.terminatedOn ?? "").localeCompare(a.terminatedOn ?? ""))
      .map((row) => [
        row.name,
        row.employeeId,
        row.terminatedOn,
        row.relationship && relationshipLabel(row.relationship),
      ]),
  ]);
}

/** One column per custom property. */
export function customPropertiesCsv(
  rows: EquityStakeholder[],
  properties: EquityCustomProperty[],
): string {
  return toCsv([
    ["Name", ...properties.map((property) => property.name)],
    ...rows
      .filter((row) => !row.mergedIntoId)
      .map((row) => [row.name, ...properties.map((property) => row.customValues[property.id])]),
  ]);
}

type Dialog =
  | { kind: "form"; stakeholder?: EquityStakeholderDetail }
  | { kind: "terminate"; stakeholders: { id: string; name: string }[] }
  | { kind: "custom" }
  | { kind: "properties"; stakeholder: EquityStakeholderDetail }
  | { kind: "merge"; stakeholders: EquityStakeholderDetail[] }
  | { kind: "bulk"; mode: "add" | "update" }
  | null;

/** The Stakeholders tab: the directory, and a profile at /stakeholders/<id>. */
export function StakeholdersTab() {
  const match = useMatch(`${BASE}/:id`);
  const navigate = useNavigate();
  const changesOpen = match?.params.id === "changes";
  const openId = changesOpen ? undefined : match?.params.id;
  const [pending, setPending] = useState(0);
  const [params, setParams] = useSearchParams();
  const duplicatesOnly = params.get("dup") === "1";
  const filters = {
    ...readFilters(params),
    ...(duplicatesOnly ? { duplicateEmployeeId: true } : {}),
  };
  const [duplicateCount, setDuplicateCount] = useState(0);
  const [inUse, setInUse] = useState({
    relationships: [] as string[],
    costCenters: [] as string[],
    countries: [] as string[],
  });
  const [customProperties, setCustomProperties] = useState<EquityCustomProperty[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [refreshKey, setRefreshKey] = useState(0);
  const [dialog, setDialog] = useState<Dialog>(null);
  const [profile, setProfile] = useState<EquityStakeholderDetail | null>(null);
  const [merges, setMerges] = useState<{
    from: { id: string; name: string }[];
    into: { id: string; name: string } | null;
  }>({ from: [], into: null });
  const [error, setError] = useState("");

  const refresh = () => setRefreshKey((key) => key + 1);

  // The filter options: values that are in use, refreshed with the list.
  useEffect(() => {
    rpc.equity.stakeholders
      .list({ pageSize: 500 })
      .then((page) => {
        const distinct = (values: (string | null | undefined)[]) =>
          [...new Set(values.filter((value): value is string => Boolean(value)))].sort();
        setInUse({
          relationships: distinct(page.items.map((row) => row.relationship)),
          costCenters: distinct(page.items.map((row) => row.costCenter)),
          countries: distinct(page.items.map((row) => row.addresses[0]?.country)),
        });
      })
      .catch(() => undefined);
  }, [refreshKey]);

  // The duplicate employee ID notice: how many stakeholders share an ID with another.
  useEffect(() => {
    rpc.equity.stakeholders
      .list({ duplicateEmployeeId: true, pageSize: 1 })
      .then((page) => setDuplicateCount(page.total))
      .catch(() => setDuplicateCount(0));
  }, [refreshKey]);

  useEffect(() => {
    rpc.equity.customProperties
      .list()
      .then((list) => setCustomProperties(list ?? []))
      .catch(() => setCustomProperties([]));
  }, []);

  useEffect(() => {
    rpc.equity.stakeholderChanges
      .counts()
      .then((counts) => setPending(counts.match + counts.termination + counts.profile))
      .catch(() => setPending(0));
  }, [refreshKey, changesOpen]);

  // Merged records stay readable: link the profile to what was merged into it, and the other way.
  useEffect(() => {
    setMerges({ from: [], into: null });
    if (!openId || !profile || profile.id !== openId) return;
    let live = true;
    rpc.equity.stakeholders
      .list({ includeMerged: true, pageSize: 500 })
      .then((page) => {
        if (!live || !page) return;
        const byId = new Map(page.items.map((row) => [row.id, row]));
        const into = profile.mergedIntoId ? byId.get(profile.mergedIntoId) : undefined;
        setMerges({
          from: page.items
            .filter((row) => row.mergedIntoId === openId)
            .map(({ id, name }) => ({ id, name })),
          into: into ? { id: into.id, name: into.name } : null,
        });
      })
      .catch(() => undefined);
    return () => {
      live = false;
    };
  }, [openId, profile]);

  useEffect(() => {
    if (!openId) return setProfile(null);
    let live = true;
    setError("");
    rpc.equity.stakeholders
      .get({ id: openId })
      .then((loaded) => live && setProfile(loaded))
      .catch((cause: unknown) => live && setError(errorText(cause)));
    return () => {
      live = false;
    };
  }, [openId, refreshKey]);

  const load = useCallback((id: string) => rpc.equity.stakeholders.get({ id }), []);
  const edit = async (id: string) => setDialog({ kind: "form", stakeholder: await load(id) });
  const terminate = async (ids: string[]) => {
    const rows = await Promise.all(ids.map(load));
    setDialog({ kind: "terminate", stakeholders: rows.map(({ id, name }) => ({ id, name })) });
  };
  const download = async (report: "contacts" | "terminations" | "custom") => {
    const page = await rpc.equity.stakeholders.list({ pageSize: 500, includeMerged: true });
    if (report === "contacts")
      return downloadText(
        "stakeholders.csv",
        contactCsv(page.items.filter((row) => !row.mergedIntoId)),
      );
    if (report === "terminations")
      return downloadText("terminations.csv", terminationsCsv(page.items));
    downloadText("custom-properties.csv", customPropertiesCsv(page.items, customProperties));
  };

  const dialogs = (
    <>
      <StakeholderFormDialog
        open={dialog?.kind === "form"}
        onOpenChange={(open) => !open && setDialog(null)}
        stakeholder={dialog?.kind === "form" ? dialog.stakeholder : undefined}
        customProperties={customProperties}
        onSaved={(saved) => {
          const created = dialog?.kind === "form" && !dialog.stakeholder;
          setDialog(null);
          refresh();
          // A new stakeholder opens its profile; an edit stays where it was made.
          if (created) navigate(`${BASE}/${saved.id}`);
        }}
      />
      <BulkImportDialog
        open={dialog?.kind === "bulk"}
        onOpenChange={(open) => !open && setDialog(null)}
        mode={dialog?.kind === "bulk" ? dialog.mode : "add"}
        customProperties={customProperties}
        onDone={refresh}
      />
      <MergeDialog
        open={dialog?.kind === "merge"}
        onOpenChange={(open) => !open && setDialog(null)}
        stakeholders={dialog?.kind === "merge" ? dialog.stakeholders : []}
        onDone={(id) => {
          setSelected([]);
          refresh();
          navigate(`${BASE}/${id}`);
        }}
      />
      {dialog?.kind === "properties" && (
        <DatedPropertiesDialog
          open
          onOpenChange={(open) => !open && setDialog(null)}
          stakeholder={dialog.stakeholder}
          onSaved={() => {
            setDialog(null);
            refresh();
          }}
        />
      )}
      <CustomPropertiesDialog
        open={dialog?.kind === "custom"}
        onOpenChange={(open) => !open && setDialog(null)}
        onChanged={setCustomProperties}
      />
      <TerminateDialog
        open={dialog?.kind === "terminate"}
        onOpenChange={(open) => !open && setDialog(null)}
        stakeholders={dialog?.kind === "terminate" ? dialog.stakeholders : []}
        onDone={() => {
          setSelected([]);
          refresh();
        }}
      />
    </>
  );

  if (changesOpen) return <StakeholderChanges onBack={() => navigate(BASE)} />;

  if (openId) {
    if (error)
      return (
        <CapTableEmptyState
          message={error}
          action={
            <Button variant="outline" size="sm" onClick={() => navigate(BASE)}>
              {t`All stakeholders`}
            </Button>
          }
        />
      );
    if (!profile) return <Skeleton className="h-64 w-full" />;
    return (
      <>
        <StakeholderProfile
          stakeholder={profile}
          customProperties={customProperties}
          onBack={() => navigate(BASE)}
          onEdit={() => setDialog({ kind: "form", stakeholder: profile })}
          onEditProperties={() => setDialog({ kind: "properties", stakeholder: profile })}
          onTerminate={() => terminate([profile.id])}
          onDownloadContact={() => downloadText(`${profile.name}.csv`, contactCsv([profile]))}
          merges={merges}
          onOpen={(id) => navigate(`${BASE}/${id}`)}
        />
        {dialogs}
      </>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-end gap-2">
        <Button
          variant="ghost"
          size="sm"
          className="me-auto"
          onClick={() => navigate(`${BASE}/changes`)}
        >
          {t`Stakeholder changes`}
          {pending > 0 && <Badge variant="secondary">{pending}</Badge>}
        </Button>
        <DropdownMenu>
          <DropdownMenuTrigger render={<Button variant="outline" size="sm" />}>
            {t`Download`}
            <ChevronDown aria-hidden="true" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="min-w-60">
            <DropdownMenuItem onClick={() => download("contacts")}>
              {t`Contact spreadsheet`}
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => download("terminations")}>
              {t`Historical terminations report`}
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => download("custom")}>
              {t`Custom properties report`}
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => navigate("/app/cap-table/reports?report=voting_rights")}
            >
              {t`Voting rights`}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
        {selected.length > 0 && (
          <DropdownMenu>
            <DropdownMenuTrigger render={<Button variant="outline" size="sm" />}>
              {t`Bulk actions (${selected.length})`}
              <ChevronDown aria-hidden="true" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="min-w-60">
              <DropdownMenuItem onClick={() => terminate(selected)}>
                {t`Terminate selected stakeholders`}
              </DropdownMenuItem>
              <DropdownMenuItem
                disabled={selected.length !== 2}
                onClick={async () => {
                  const rows = await Promise.all(selected.map(load));
                  setDialog({
                    kind: "merge",
                    stakeholders: rows,
                  });
                }}
              >
                {t`Merge stakeholders`}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
        <DropdownMenu>
          <DropdownMenuTrigger render={<Button size="sm" />}>
            {t`Manage stakeholders`}
            <ChevronDown aria-hidden="true" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="min-w-60">
            <DropdownMenuGroup>
              <DropdownMenuLabel>{t`Manage stakeholders`}</DropdownMenuLabel>
              <DropdownMenuItem onClick={() => setDialog({ kind: "form" })}>
                {t`Add stakeholder`}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setDialog({ kind: "bulk", mode: "add" })}>
                {t`Bulk add stakeholders`}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setDialog({ kind: "bulk", mode: "update" })}>
                {t`Bulk update stakeholders`}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => navigate(`${BASE}/changes`)}>
                {t`Import payroll data`}
              </DropdownMenuItem>
            </DropdownMenuGroup>
            <DropdownMenuGroup>
              <DropdownMenuLabel>{t`Stakeholder properties`}</DropdownMenuLabel>
              <DropdownMenuItem onClick={() => setDialog({ kind: "custom" })}>
                {t`Add custom properties`}
              </DropdownMenuItem>
            </DropdownMenuGroup>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      {(duplicateCount > 0 || duplicatesOnly) && (
        <div className="flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm">
          <span>
            {duplicateCount === 1
              ? t`1 stakeholder shares an employee ID`
              : t`${duplicateCount} stakeholders share an employee ID`}
          </span>
          <Button
            variant="ghost"
            size="sm"
            className="ms-auto"
            onClick={() =>
              setParams(
                (current) => {
                  const next = new URLSearchParams(current);
                  if (duplicatesOnly) next.delete("dup");
                  else next.set("dup", "1");
                  next.delete("page");
                  return next;
                },
                { replace: true },
              )
            }
          >
            {duplicatesOnly ? t`Show all` : t`Show`}
          </Button>
        </div>
      )}
      <StakeholdersTable
        filters={filters}
        tools={
          <>
            <SavedViewsMenu />
            <StakeholderFilters
              value={filters}
              onChange={(next) =>
                setParams(
                  (current) => {
                    const updated = new URLSearchParams(current);
                    for (const [key, value] of Object.entries(writeFilters(next)))
                      if (value) updated.set(key, value);
                      else updated.delete(key);
                    updated.delete("page");
                    return updated;
                  },
                  { replace: true },
                )
              }
              relationshipsInUse={inUse.relationships}
              costCentersInUse={inUse.costCenters}
              countriesInUse={inUse.countries}
            />
          </>
        }
        onOpen={(id) => navigate(`${BASE}/${id}`)}
        onEdit={edit}
        onEditProperties={async (id) =>
          setDialog({ kind: "properties", stakeholder: await load(id) })
        }
        onTerminate={(id) => terminate([id])}
        selected={selected}
        onSelectedChange={setSelected}
        refreshKey={refreshKey}
      />
      {dialogs}
    </div>
  );
}
