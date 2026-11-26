import { t } from "@lingui/core/macro";
import type {
  EquityChangeField,
  EquityChangeProposed,
  EquityStakeholder,
  EquityStakeholderChange,
  EquityStakeholderDetail,
  EquityTerminationResult,
} from "@rakazo/contracts";
import {
  Badge,
  Button,
  Checkbox,
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  NativeSelect,
  NativeSelectOption,
  Skeleton,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableHeadRow,
  TableRow,
  Tabs,
  TabsList,
  TabsTrigger,
} from "@rakazo/ui-web";
import { ArrowLeft } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { rpc } from "../../../lib/rpc";
import { errorText } from "../../../lib/user-error";
import { formatDay, formatShares } from "../options/format";
import { CapTableEmptyState } from "../shell/CapTableEmptyState";
import { HrisPreferencesDialog } from "./HrisPreferencesDialog";
import { csvDate, csvRecords } from "./stakeholder-csv";

type Kind = "match" | "termination" | "profile";
type Counts = {
  match: number;
  termination: number;
  profile: number;
  lastProposedAt: string | null;
};

/** A row of an employee file as the import input. Headers are matched loosely. */
export function changeRowsFromCsv(text: string) {
  return csvRecords(text)
    .map((record) => {
      const pick = (...keys: string[]) => keys.map((key) => record[key]).find(Boolean) || undefined;
      const firstName = pick("firstname");
      const lastName = pick("lastname");
      const name = pick("name", "fullname") ?? [firstName, lastName].filter(Boolean).join(" ");
      const address = {
        country: pick("country") ?? null,
        street: pick("street", "streetaddress") ?? null,
        city: pick("city") ?? null,
        state: pick("state", "stateprovince") ?? null,
        postalCode: pick("postalcode", "zip", "zipcode", "zippostalcode") ?? null,
      };
      const proposed: EquityChangeProposed = {
        firstName,
        lastName,
        contactEmail: pick("email", "contactemail", "workemail"),
        dateOfBirth: csvDate(pick("dateofbirth", "birthdate")),
        taxId: pick("taxid"),
        jobTitle: pick("jobtitle", "title"),
        costCenter: pick("costcenter"),
        department: pick("department"),
        ...(Object.values(address).some(Boolean) ? { address } : {}),
      };
      return {
        employeeId: pick("employeeid", "id"),
        name,
        email: pick("email", "contactemail", "workemail"),
        terminationDate: csvDate(pick("terminationdate", "enddate")),
        proposed: Object.fromEntries(
          Object.entries(proposed).filter(([, value]) => value !== undefined),
        ) as EquityChangeProposed,
      };
    })
    .filter((row) => row.name);
}

const FIELD_LABELS = (): Record<EquityChangeField, string> => ({
  firstName: t`First name`,
  lastName: t`Last name`,
  contactEmail: t`Email`,
  dateOfBirth: t`Date of birth`,
  taxId: t`Tax ID`,
  jobTitle: t`Job title`,
  costCenter: t`Cost center`,
  department: t`Department`,
  address: t`Address`,
});

const addressText = (value: EquityChangeProposed["address"] | undefined) =>
  value
    ? [value.street, value.city, value.state, value.postalCode, value.country]
        .filter(Boolean)
        .join(", ")
    : "";

/** The stored value of a field, as text. */
export function currentValue(stakeholder: EquityStakeholderDetail, field: EquityChangeField) {
  if (field === "address") return addressText(stakeholder.addresses[0]);
  return stakeholder[field] ?? "";
}

function ProfileReview({
  change,
  onResolved,
}: {
  change: EquityStakeholderChange;
  onResolved: () => void;
}) {
  const [stakeholder, setStakeholder] = useState<EquityStakeholderDetail | null>(null);
  const [chosen, setChosen] = useState<EquityChangeField[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => {
    if (change.stakeholderId)
      rpc.equity.stakeholders
        .get({ id: change.stakeholderId })
        .then(setStakeholder)
        .catch((cause: unknown) => setError(errorText(cause)));
  }, [change.stakeholderId]);
  const labels = FIELD_LABELS();
  const fields = (Object.keys(change.proposed) as EquityChangeField[]).filter(
    (field) => change.proposed[field] !== undefined,
  );
  const resolve = async (decision: "accept" | "reject") => {
    setSaving(true);
    try {
      await rpc.equity.stakeholderChanges.resolve({
        id: change.id,
        decision,
        ...(decision === "accept" ? { fields: chosen } : {}),
      });
      onResolved();
    } catch (cause) {
      setError(errorText(cause));
    } finally {
      setSaving(false);
    }
  };
  if (!stakeholder)
    return error ? (
      <p className="text-sm text-destructive">{error}</p>
    ) : (
      <Skeleton className="h-24" />
    );
  return (
    <div className="flex flex-col gap-3 rounded-lg border border-border p-3">
      <Table>
        <TableHeader>
          <TableHeadRow>
            <TableHead>{t`Field`}</TableHead>
            <TableHead>{t`Current`}</TableHead>
            <TableHead className="w-8">
              <span className="sr-only">{t`Accept`}</span>
            </TableHead>
            <TableHead>{t`Proposed`}</TableHead>
          </TableHeadRow>
        </TableHeader>
        <TableBody>
          {fields.map((field) => {
            const proposed =
              field === "address"
                ? addressText(change.proposed.address)
                : String(change.proposed[field] ?? "");
            const current = currentValue(stakeholder, field);
            const differs = proposed !== current;
            return (
              <TableRow key={field}>
                <TableCell className="text-muted-foreground">{labels[field]}</TableCell>
                <TableCell>{current}</TableCell>
                <TableCell>
                  <Checkbox
                    aria-label={t`Accept ${labels[field]}`}
                    disabled={!differs}
                    checked={chosen.includes(field)}
                    onCheckedChange={(checked) =>
                      setChosen((now) =>
                        checked ? [...now, field] : now.filter((f) => f !== field),
                      )
                    }
                  />
                </TableCell>
                <TableCell className={differs ? "font-medium" : "text-muted-foreground"}>
                  {proposed}
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
      {error && <p className="text-sm text-destructive">{error}</p>}
      <div className="flex justify-end gap-2">
        <Button variant="outline" size="sm" disabled={saving} onClick={() => resolve("reject")}>
          {t`Dismiss update`}
        </Button>
        <Button
          size="sm"
          disabled={saving || chosen.length === 0}
          onClick={() => resolve("accept")}
        >
          {t`Update`}
        </Button>
      </div>
    </div>
  );
}

function MatchRow({
  change,
  stakeholders,
  onResolved,
}: {
  change: EquityStakeholderChange;
  stakeholders: EquityStakeholder[];
  onResolved: () => void;
}) {
  const [target, setTarget] = useState("");
  const [error, setError] = useState("");
  const resolve = async (input: {
    decision: "accept" | "reject";
    stakeholderId?: string;
    create?: boolean;
  }) => {
    try {
      await rpc.equity.stakeholderChanges.resolve({ id: change.id, ...input });
      onResolved();
    } catch (cause) {
      setError(errorText(cause));
    }
  };
  return (
    <TableRow>
      <TableCell>{change.employeeId}</TableCell>
      <TableCell>
        <div className="font-medium">{change.externalName}</div>
        <div className="text-muted-foreground">{change.externalEmail}</div>
        {error && <div className="text-destructive">{error}</div>}
      </TableCell>
      <TableCell>
        <div className="flex flex-wrap items-center gap-2">
          <NativeSelect
            aria-label={t`Stakeholder to link`}
            value={target}
            onChange={(event) => setTarget(event.target.value)}
          >
            <NativeSelectOption value="">{t`Choose a stakeholder`}</NativeSelectOption>
            {stakeholders.map((row) => (
              <NativeSelectOption key={row.id} value={row.id}>
                {row.name}
              </NativeSelectOption>
            ))}
          </NativeSelect>
          <Button
            size="sm"
            disabled={!target}
            onClick={() => resolve({ decision: "accept", stakeholderId: target })}
          >{t`Link`}</Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => resolve({ decision: "accept", create: true })}
          >
            {t`Add as stakeholder`}
          </Button>
          <Button size="sm" variant="ghost" onClick={() => resolve({ decision: "reject" })}>
            {t`Ignore`}
          </Button>
        </div>
      </TableCell>
    </TableRow>
  );
}

/** What an import did, naming only the parts that happened. */
export function importSummary(result: {
  profile: number;
  termination: number;
  match: number;
  unchanged: number;
  applied?: number;
  created?: number;
}): string {
  const automatic = (result.applied ?? 0) + (result.created ?? 0);
  const parts = [
    result.profile &&
      (result.profile === 1
        ? t`1 profile change to review`
        : t`${result.profile} profile changes to review`),
    result.termination &&
      (result.termination === 1
        ? t`1 termination to review`
        : t`${result.termination} terminations to review`),
    result.match &&
      (result.match === 1 ? t`1 employee to match` : t`${result.match} employees to match`),
    automatic && t`${automatic} applied automatically`,
    result.unchanged && t`${result.unchanged} unchanged`,
  ].filter(Boolean);
  return parts.length ? parts.join(", ") : t`Nothing new in this file`;
}

/** Stakeholder Changes: review what an imported employee file or a holder proposes. */
export function StakeholderChanges({ onBack }: { onBack: () => void }) {
  const [kind, setKind] = useState<Kind>("profile");
  const [counts, setCounts] = useState<Counts | null>(null);
  const [changes, setChanges] = useState<EquityStakeholderChange[] | null>(null);
  const [stakeholders, setStakeholders] = useState<EquityStakeholder[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [open, setOpen] = useState<string | null>(null);
  const [reload, setReload] = useState(0);
  const [message, setMessage] = useState("");
  const [preferences, setPreferences] = useState(false);
  const [busy, setBusy] = useState(false);
  // What accepting the selected terminations does to option grants, shown before anything commits.
  const [review, setReview] = useState<EquityTerminationResult["grants"] | null>(null);
  const file = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let live = true;
    setChanges(null);
    Promise.all([
      rpc.equity.stakeholderChanges.counts(),
      rpc.equity.stakeholderChanges.list({ kind, pageSize: 500 }),
    ])
      .then(([nextCounts, page]) => {
        if (!live) return;
        setCounts(nextCounts);
        setChanges(page.items);
      })
      .catch((cause: unknown) => live && setMessage(errorText(cause)));
    return () => {
      live = false;
    };
  }, [kind, reload]);

  useEffect(() => {
    if (kind === "match")
      rpc.equity.stakeholders
        .list({ pageSize: 500 })
        .then((page) => setStakeholders(page.items))
        .catch(() => setStakeholders([]));
  }, [kind]);

  const refresh = () => {
    setSelected([]);
    setReload((n) => n + 1);
  };

  const importFile = async (picked: File | undefined) => {
    if (!picked || busy) return;
    setBusy(true);
    try {
      const rows = changeRowsFromCsv(await picked.text());
      if (!rows.length) return setMessage(t`No rows found in ${picked.name}`);
      const result = await rpc.equity.stakeholderChanges.import({ rows });
      setMessage(importSummary(result));
      refresh();
    } catch (cause) {
      setMessage(errorText(cause));
    } finally {
      if (file.current) file.current.value = "";
      setBusy(false);
    }
  };

  const reviewTerminations = async () => {
    if (busy) return;
    setBusy(true);
    try {
      const chosen = (changes ?? []).filter((change) => selected.includes(change.id));
      const previews = await Promise.all(
        chosen.flatMap((change) =>
          change.stakeholderId && change.terminationDate
            ? [
                rpc.equity.optionActions.previewTermination({
                  stakeholderId: change.stakeholderId,
                  terminatedOn: change.terminationDate,
                }),
              ]
            : [],
        ),
      );
      setReview(previews.flatMap((preview) => preview.grants));
    } catch (cause) {
      setMessage(errorText(cause));
    } finally {
      setBusy(false);
    }
  };

  const terminateSelected = async () => {
    setBusy(true);
    setReview(null);
    const failures: string[] = [];
    try {
      for (const id of selected) {
        try {
          await rpc.equity.stakeholderChanges.resolve({ id, decision: "accept" });
        } catch (cause) {
          failures.push(errorText(cause));
        }
      }
      if (failures.length) setMessage(failures.join(" "));
    } finally {
      // Refresh even when some failed, so the list shows what was actually terminated.
      refresh();
      setBusy(false);
    }
  };

  const queueEmpty = counts != null && counts.match + counts.termination + counts.profile === 0;
  const tabs: [Kind, string][] = [
    ["match", t`Match employees`],
    ["termination", t`Terminations`],
    ["profile", t`Profile changes`],
  ];

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <Button variant="ghost" size="sm" onClick={onBack}>
          <ArrowLeft aria-hidden="true" />
          {t`Stakeholders`}
        </Button>
        <h2 className="text-lg font-semibold">{t`Stakeholder changes`}</h2>
        <div className="ms-auto flex gap-2">
          <Button variant="outline" size="sm" onClick={() => setPreferences(true)}>
            {t`Preferences`}
          </Button>
          <Button size="sm" onClick={() => file.current?.click()}>
            {t`Import payroll data`}
          </Button>
          <input
            ref={file}
            type="file"
            accept=".csv,text/csv"
            className="hidden"
            aria-label={t`Payroll file`}
            onChange={(event) => importFile(event.target.files?.[0])}
          />
        </div>
      </div>
      {message && <p className="text-sm text-muted-foreground">{message}</p>}
      {!queueEmpty && (
        <Tabs value={kind} onValueChange={(next) => setKind(next as Kind)}>
          <TabsList>
            {tabs.map(([id, label]) => (
              <TabsTrigger key={id} value={id}>
                {label}
                {(counts?.[id] ?? 0) > 0 && (
                  <Badge variant="secondary" className="ms-1">
                    {counts?.[id]}
                  </Badge>
                )}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
      )}
      {!changes ? (
        <Skeleton className="h-32 w-full" />
      ) : queueEmpty ? (
        <CapTableEmptyState message={t`Nothing to review`} />
      ) : changes.length === 0 ? (
        <CapTableEmptyState
          message={
            kind === "match"
              ? t`No employees to match`
              : kind === "termination"
                ? t`There are no pending terminations`
                : t`No profile changes to review`
          }
        />
      ) : kind === "match" ? (
        <Table>
          <TableHeader>
            <TableHeadRow>
              <TableHead>{t`Employee ID`}</TableHead>
              <TableHead>{t`Employee`}</TableHead>
              <TableHead>{t`Match`}</TableHead>
            </TableHeadRow>
          </TableHeader>
          <TableBody>
            {changes.map((change) => (
              <MatchRow
                key={change.id}
                change={change}
                stakeholders={stakeholders}
                onResolved={refresh}
              />
            ))}
          </TableBody>
        </Table>
      ) : kind === "termination" ? (
        <div className="flex flex-col gap-2">
          <div className="flex justify-end">
            <Button
              size="sm"
              variant="destructive"
              disabled={!selected.length || busy}
              onClick={reviewTerminations}
            >
              {t`Terminate selected`}
            </Button>
          </div>
          <Table>
            <TableHeader>
              <TableHeadRow>
                <TableHead className="w-8">
                  <Checkbox
                    aria-label={t`Select all`}
                    checked={selected.length === changes.length}
                    onCheckedChange={(checked) =>
                      setSelected(checked ? changes.map((c) => c.id) : [])
                    }
                  />
                </TableHead>
                <TableHead>{t`Employee ID`}</TableHead>
                <TableHead>{t`Stakeholder`}</TableHead>
                <TableHead>{t`Termination date`}</TableHead>
                <TableHead className="w-24" />
              </TableHeadRow>
            </TableHeader>
            <TableBody>
              {changes.map((change) => (
                <TableRow key={change.id}>
                  <TableCell>
                    <Checkbox
                      aria-label={t`Select ${change.stakeholderName ?? ""}`}
                      checked={selected.includes(change.id)}
                      onCheckedChange={(checked) =>
                        setSelected((now) =>
                          checked ? [...now, change.id] : now.filter((id) => id !== change.id),
                        )
                      }
                    />
                  </TableCell>
                  <TableCell>{change.employeeId}</TableCell>
                  <TableCell>{change.stakeholderName}</TableCell>
                  <TableCell>{change.terminationDate}</TableCell>
                  <TableCell>
                    <Button
                      size="sm"
                      variant="ghost"
                      disabled={busy}
                      onClick={() => {
                        setBusy(true);
                        rpc.equity.stakeholderChanges
                          .resolve({ id: change.id, decision: "reject" })
                          .then(refresh, (cause: unknown) => setMessage(errorText(cause)))
                          .finally(() => setBusy(false));
                      }}
                    >{t`Dismiss`}</Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          <p className="text-sm text-muted-foreground">{t`${changes.length} stakeholders to review`}</p>
          {changes.map((change) => {
            const count = Object.keys(change.proposed).length;
            return (
              <div key={change.id} className="flex flex-col gap-2">
                <button
                  type="button"
                  className="flex items-center justify-between rounded-lg border border-border px-3 py-2 text-start"
                  onClick={() => setOpen(open === change.id ? null : change.id)}
                  aria-expanded={open === change.id}
                >
                  <span>
                    <span className="font-medium">{change.stakeholderName}</span>
                    <span className="ms-2 text-sm text-muted-foreground">
                      {change.externalEmail}
                    </span>
                  </span>
                  <span className="text-sm text-muted-foreground">
                    {open === change.id
                      ? t`Hide`
                      : count === 1
                        ? t`View 1 update`
                        : t`View ${count} updates`}
                  </span>
                </button>
                {open === change.id && <ProfileReview change={change} onResolved={refresh} />}
              </div>
            );
          })}
        </div>
      )}
      <Dialog open={review != null} onOpenChange={(next) => !next && setReview(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {selected.length === 1
                ? t`Terminate stakeholder`
                : t`Terminate ${selected.length} stakeholders`}
            </DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-1 text-sm">
            {(changes ?? [])
              .filter((change) => selected.includes(change.id))
              .map((change) => (
                <p key={change.id}>
                  {t`${change.stakeholderName ?? change.externalName ?? ""} stop vesting on ${change.terminationDate ? formatDay(change.terminationDate) : "—"}.`}
                </p>
              ))}
            {(review ?? []).map((row) => (
              <p key={row.optionGrantId} className="text-muted-foreground">
                {t`${row.label}: ${formatShares(row.forfeitedQuantity)} forfeited, exercise by ${row.exerciseDeadline ? formatDay(row.exerciseDeadline) : "—"}`}
              </p>
            ))}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setReview(null)}>{t`Back`}</Button>
            <Button variant="destructive" disabled={busy} onClick={terminateSelected}>
              {t`Terminate`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <HrisPreferencesDialog open={preferences} onOpenChange={setPreferences} />
    </div>
  );
}
