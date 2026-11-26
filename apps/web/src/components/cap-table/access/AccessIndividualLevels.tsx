import { t } from "@lingui/core/macro";
import type {
  EquityAccessGrant,
  EquityAccessGroup,
  EquityAccessHolder,
  EquityAccessLevel,
  EquityStakeholder,
} from "@rakazo/contracts";
import { EQUITY_RELATIONSHIP_LABELS } from "@rakazo/contracts";
import {
  Badge,
  Button,
  Checkbox,
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  enqueueNotificationToast,
  Input,
  Label,
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
} from "@rakazo/ui-web";
import { useEffect, useState } from "react";
import { rpc } from "../../../lib/rpc";
import { errorText } from "../../../lib/user-error";
import { CapTableEmptyState } from "../shell/CapTableEmptyState";
import { AccessPreview } from "./AccessPreview";
import { ACCESS_LEVELS, accessGroupOf, levelLabel } from "./access-levels";

type Loaded = {
  stakeholders: EquityStakeholder[];
  holders: Map<string, EquityAccessHolder>;
  grants: Map<string, EquityAccessGrant>;
  groups: Map<string, EquityAccessLevel>;
};

/** Each stakeholder's level, with overrides of the group level for one or many at once. */
export function AccessIndividualLevels() {
  const [search, setSearch] = useState("");
  const [data, setData] = useState<Loaded | null>(null);
  const [error, setError] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [editing, setEditing] = useState<string[] | null>(null);
  const [choice, setChoice] = useState<EquityAccessLevel | "group">("group");
  const [saving, setSaving] = useState(false);
  const [reload, setReload] = useState(0);
  const [preview, setPreview] = useState<EquityStakeholder | null>(null);

  useEffect(() => {
    let live = true;
    const query = search.trim() ? { search: search.trim() } : {};
    Promise.all([
      rpc.equity.stakeholders.list({ ...query, page: 1, pageSize: 500 }),
      rpc.equity.accessGrants.list({ page: 1, pageSize: 500 }),
      rpc.equity.accessGroups.list(),
      rpc.equity.accessHolders.list({ page: 1, pageSize: 500 }),
    ])
      .then(([stakeholders, grants, groups, holders]) => {
        if (!live) return;
        setData({
          stakeholders: stakeholders.items,
          holders: new Map(holders.items.map((row) => [row.stakeholderId, row])),
          grants: new Map(grants.items.map((grant) => [grant.stakeholderId, grant])),
          groups: new Map(groups.map((group: EquityAccessGroup) => [group.key, group.level])),
        });
      })
      .catch((cause: unknown) => {
        if (live) setError(errorText(cause));
      });
    return () => {
      live = false;
    };
  }, [search, reload]);

  if (error)
    return (
      <p role="alert" className="text-sm text-destructive">
        {error}
      </p>
    );

  const groupLevel = (row: EquityStakeholder) =>
    data?.groups.get(accessGroupOf(row.relationship)) ?? "basic";
  const override = (row: EquityStakeholder) => data?.grants.get(row.id)?.level ?? null;

  const open = (ids: string[]) => {
    const only = ids.length === 1 ? data?.stakeholders.find((row) => row.id === ids[0]) : null;
    setChoice((only && override(only)) || "group");
    setEditing(ids);
  };

  const save = async () => {
    if (!editing) return;
    setSaving(true);
    try {
      const level = choice === "group" ? null : choice;
      for (const stakeholderId of editing)
        await rpc.equity.accessGrants.set({ stakeholderId, level });
      setEditing(null);
      setSelected(new Set());
      setReload((count) => count + 1);
    } catch (cause) {
      enqueueNotificationToast({
        id: "cap-table-access-grant-failed",
        title: t`Could not change access`,
        body: errorText(cause),
      });
    } finally {
      setSaving(false);
    }
  };

  const rows = data?.stakeholders ?? [];
  const allSelected = rows.length > 0 && rows.every((row) => selected.has(row.id));
  const editingOne = editing?.length === 1 ? rows.find((row) => row.id === editing[0]) : undefined;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <Input
          aria-label={t`Search stakeholders`}
          placeholder={t`Search`}
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          className="w-56"
        />
        {selected.size > 0 ? (
          <Button size="sm" className="ms-auto" onClick={() => open([...selected])}>
            {t`Edit access level (${selected.size})`}
          </Button>
        ) : null}
      </div>
      {data == null ? (
        <Skeleton className="h-56 w-full" />
      ) : rows.length === 0 ? (
        <CapTableEmptyState
          message={search ? t`No matching stakeholders` : t`No stakeholders yet`}
        />
      ) : (
        <Table>
          <TableHeader>
            <TableHeadRow>
              <TableHead className="w-8">
                <Checkbox
                  aria-label={t`Select all`}
                  checked={allSelected}
                  onCheckedChange={(checked) =>
                    setSelected(checked ? new Set(rows.map((row) => row.id)) : new Set())
                  }
                />
              </TableHead>
              <TableHead>{t`Stakeholder`}</TableHead>
              <TableHead>{t`Relationship`}</TableHead>
              <TableHead>{t`Holdings`}</TableHead>
              <TableHead className="text-end">{t`Ownership`}</TableHead>
              <TableHead>{t`Access level`}</TableHead>
              <TableHead className="w-32" />
            </TableHeadRow>
          </TableHeader>
          <TableBody aria-label={t`Individual levels`}>
            {rows.map((row) => {
              const own = override(row);
              const holder = data.holders.get(row.id);
              return (
                <TableRow key={row.id}>
                  <TableCell>
                    <Checkbox
                      aria-label={t`Select ${row.name}`}
                      checked={selected.has(row.id)}
                      onCheckedChange={(checked) => {
                        const next = new Set(selected);
                        if (checked) next.add(row.id);
                        else next.delete(row.id);
                        setSelected(next);
                      }}
                    />
                  </TableCell>
                  <TableCell className="font-medium">{row.name}</TableCell>
                  <TableCell>
                    {row.relationship ? EQUITY_RELATIONSHIP_LABELS[row.relationship] : "—"}
                  </TableCell>
                  <TableCell>
                    {holder?.classCodes.length ? (
                      <span className="flex flex-wrap gap-1">
                        {holder.classCodes.map((code) => (
                          <Badge key={code} variant="outline">
                            {code}
                          </Badge>
                        ))}
                      </span>
                    ) : (
                      "—"
                    )}
                  </TableCell>
                  <TableCell className="text-end tabular-nums">
                    {`${Number(holder?.ownershipPercent ?? 0).toFixed(2)}%`}
                  </TableCell>
                  <TableCell>
                    <span className="flex items-center gap-2">
                      {levelLabel(own ?? groupLevel(row))}
                      {own ? <Badge variant="outline">{t`Override`}</Badge> : null}
                    </span>
                  </TableCell>
                  <TableCell>
                    <div className="flex justify-end gap-1">
                      <Button variant="ghost" size="sm" onClick={() => setPreview(row)}>
                        {t`Preview`}
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => open([row.id])}>
                        {t`Edit`}
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      )}
      {preview ? (
        <AccessPreview
          stakeholderId={preview.id}
          name={preview.name}
          open
          onOpenChange={(next) => (next ? null : setPreview(null))}
        />
      ) : null}
      <Dialog open={editing != null} onOpenChange={(next) => (next ? null : setEditing(null))}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingOne ? editingOne.name : t`${editing?.length ?? 0} stakeholders`}
            </DialogTitle>
          </DialogHeader>
          <Label className="flex flex-col items-start gap-1.5 text-sm">
            {t`Access level`}
            <NativeSelect
              value={choice}
              onChange={(event) => setChoice(event.target.value as EquityAccessLevel | "group")}
            >
              <NativeSelectOption value="group">
                {editingOne
                  ? t`Use group level (${levelLabel(groupLevel(editingOne))})`
                  : t`Use group level`}
              </NativeSelectOption>
              {ACCESS_LEVELS.map((value) => (
                <NativeSelectOption key={value} value={value}>
                  {levelLabel(value)}
                </NativeSelectOption>
              ))}
            </NativeSelect>
          </Label>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditing(null)}>
              {t`Cancel`}
            </Button>
            <Button disabled={saving} onClick={() => void save()}>
              {t`Save`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
