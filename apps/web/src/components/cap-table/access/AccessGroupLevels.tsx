import { t } from "@lingui/core/macro";
import type { EquityAccessGroup, EquityAccessGroupKey, EquityAccessLevel } from "@rakazo/contracts";
import {
  Badge,
  Button,
  enqueueNotificationToast,
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
import { ACCESS_LEVELS, groupText, levelLabel, RECOMMENDED_LEVEL } from "./access-levels";

/** The default level of each stakeholder group, saved together. */
export function AccessGroupLevels() {
  const [groups, setGroups] = useState<EquityAccessGroup[] | null>(null);
  const [draft, setDraft] = useState<Partial<Record<EquityAccessGroupKey, EquityAccessLevel>>>({});
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let live = true;
    rpc.equity.accessGroups
      .list()
      .then((loaded) => {
        if (live) setGroups(loaded);
      })
      .catch((cause: unknown) => {
        if (live) setError(errorText(cause));
      });
    return () => {
      live = false;
    };
  }, []);

  if (error)
    return (
      <p role="alert" className="text-sm text-destructive">
        {error}
      </p>
    );
  if (groups == null) return <Skeleton className="h-56 w-full" />;

  const changed = groups.filter((group) => draft[group.key] && draft[group.key] !== group.level);

  const save = async () => {
    setSaving(true);
    try {
      const saved = await Promise.all(
        changed.map((group) =>
          rpc.equity.accessGroups.set({ key: group.key, level: draft[group.key]! }),
        ),
      );
      setGroups(groups.map((group) => saved.find((row) => row.key === group.key) ?? group));
      setDraft({});
      enqueueNotificationToast({
        id: "cap-table-access-groups-saved",
        title: t`Access levels saved`,
      });
    } catch (cause) {
      enqueueNotificationToast({
        id: "cap-table-access-groups-failed",
        title: t`Could not save access levels`,
        body: errorText(cause),
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex flex-col gap-3">
      <Table>
        <TableHeader>
          <TableHeadRow>
            <TableHead>{t`Group`}</TableHead>
            <TableHead className="text-end">{t`Stakeholders`}</TableHead>
            <TableHead>{t`Access level`}</TableHead>
          </TableHeadRow>
        </TableHeader>
        <TableBody aria-label={t`Group levels`}>
          {groups.map((group) => {
            const { name, description } = groupText(group.key);
            const level = draft[group.key] ?? group.level;
            return (
              <TableRow key={group.key}>
                <TableCell>
                  <div className="font-medium">{name}</div>
                  <div className="text-xs text-muted-foreground">{description}</div>
                </TableCell>
                <TableCell className="text-end tabular-nums">{group.memberCount}</TableCell>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <NativeSelect
                      aria-label={t`Access level for ${name}`}
                      value={level}
                      onChange={(event) =>
                        setDraft({
                          ...draft,
                          [group.key]: event.target.value as EquityAccessLevel,
                        })
                      }
                    >
                      {ACCESS_LEVELS.map((value) => (
                        <NativeSelectOption key={value} value={value}>
                          {levelLabel(value)}
                        </NativeSelectOption>
                      ))}
                    </NativeSelect>
                    {level === RECOMMENDED_LEVEL[group.key] ? (
                      <Badge variant="secondary">{t`Recommended`}</Badge>
                    ) : null}
                  </div>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-xs text-muted-foreground">
          {t`Stakeholders lose access when they no longer have outstanding holdings`}
        </p>
        <Button size="sm" disabled={saving || changed.length === 0} onClick={() => void save()}>
          {t`Save access levels`}
        </Button>
      </div>
    </div>
  );
}
