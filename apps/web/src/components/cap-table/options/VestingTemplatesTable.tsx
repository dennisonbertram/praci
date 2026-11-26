import { t } from "@lingui/core/macro";
import type { EquityVestingTemplate } from "@rakazo/contracts";
import {
  Button,
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
import { describeTemplate, VestingTemplateForm } from "./VestingTemplateForm";

const PAGE_SIZE = 100;
const DASH = "—";

/** The vesting templates the options area applies to a grant, with their schedules. */
export function VestingTemplatesTable({ refreshKey = 0 }: { refreshKey?: number }) {
  const [templates, setTemplates] = useState<EquityVestingTemplate[] | null>(null);
  const [error, setError] = useState("");
  const [reloadCount, setReloadCount] = useState(0);
  const [form, setForm] = useState<{ template: EquityVestingTemplate | null } | null>(null);

  useEffect(() => {
    let live = true;
    setError("");
    rpc.equity.vestingTemplates
      .list({ page: 1, pageSize: PAGE_SIZE, sort: { field: "name", dir: "asc" } })
      .then((loaded) => {
        if (live) setTemplates(loaded.items);
      })
      .catch((cause: unknown) => {
        if (live) setError(errorText(cause));
      });
    return () => {
      live = false;
    };
  }, [refreshKey, reloadCount]);

  if (error)
    return (
      <div role="alert" className="flex flex-wrap items-center gap-3 text-sm">
        <span className="text-destructive">{error}</span>
        <Button variant="outline" size="sm" onClick={() => setReloadCount((count) => count + 1)}>
          {t`Try again`}
        </Button>
      </div>
    );

  const addButton = (
    <Button size="sm" className="rounded-full" onClick={() => setForm({ template: null })}>
      {t`Add template`}
    </Button>
  );

  return (
    <div>
      <div className="mb-2 flex items-center justify-end">{addButton}</div>
      {templates == null ? (
        <div className="flex flex-col gap-2">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-40 w-full" />
        </div>
      ) : templates.length === 0 ? (
        <CapTableEmptyState message={t`No vesting templates yet`} action={addButton} />
      ) : (
        <Table compact>
          <TableHeader>
            <TableHeadRow>
              <TableHead>{t`Name`}</TableHead>
              <TableHead>{t`Schedule`}</TableHead>
              <TableHead className="text-end">{t`Total months`}</TableHead>
              <TableHead className="text-end">{t`Cliff`}</TableHead>
              <TableHead className="w-10">
                <span className="sr-only">{t`Actions`}</span>
              </TableHead>
            </TableHeadRow>
          </TableHeader>
          <TableBody aria-label={t`Vesting templates`}>
            {templates.map((template) => (
              <TableRow key={template.id} data-template-id={template.id}>
                <TableCell className="font-medium">{template.name}</TableCell>
                <TableCell className="text-muted-foreground">
                  {describeTemplate(template)}
                </TableCell>
                <TableCell className="text-end tabular-nums">{template.totalMonths}</TableCell>
                <TableCell className="text-end tabular-nums">
                  {template.cliffMonths > 0 ? template.cliffMonths : DASH}
                </TableCell>
                <TableCell className="w-10 pe-0 text-end">
                  <Button
                    variant="ghost"
                    size="sm"
                    aria-label={t`Edit ${template.name}`}
                    onClick={() => setForm({ template })}
                  >
                    {t`Edit`}
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
      {form && (
        <VestingTemplateForm
          template={form.template}
          onClose={() => setForm(null)}
          onSaved={() => {
            setForm(null);
            setReloadCount((count) => count + 1);
          }}
        />
      )}
    </div>
  );
}
