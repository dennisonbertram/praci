import { t } from "@lingui/core/macro";
import type { EquityCustomProperty, EquityStakeholder } from "@rakazo/contracts";
import {
  Button,
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  NativeSelect,
  NativeSelectOption,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableHeadRow,
  TableRow,
} from "@rakazo/ui-web";
import { useEffect, useRef, useState } from "react";
import { listAllPages } from "../../../lib/list-all";
import { rpc } from "../../../lib/rpc";
import { errorText } from "../../../lib/user-error";
import { downloadText, parseCsv } from "./stakeholder-csv";
import type { ImportField } from "./stakeholder-import";
import {
  autoMap,
  rowsToCreateInputs,
  rowsToUpdateInputs,
  TEMPLATE_FIELDS,
  templateCsv,
} from "./stakeholder-import";

type Sheet = { name: string; headers: string[]; rows: string[][] };

/** Bulk add or bulk update from a spreadsheet: template, column mapping, review, then save. */
export function BulkImportDialog({
  open,
  onOpenChange,
  mode,
  customProperties,
  onDone,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: "add" | "update";
  customProperties: EquityCustomProperty[];
  onDone: (count: number) => void;
}) {
  const [sheet, setSheet] = useState<Sheet | null>(null);
  const picker = useRef<HTMLInputElement>(null);
  const [mapping, setMapping] = useState<ImportField[]>([]);
  const [existing, setExisting] = useState<EquityStakeholder[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!open) return;
    setSheet(null);
    setError("");
    if (mode === "update")
      listAllPages((page) => rpc.equity.stakeholders.list({ page, pageSize: 500 }))
        .then(setExisting)
        .catch(() => setExisting([]));
  }, [open, mode]);

  const read = async (file: File | undefined) => {
    if (!file) return;
    const [headers = [], ...rows] = parseCsv(await file.text());
    setSheet({ name: file.name, headers, rows });
    setMapping(autoMap(headers, customProperties));
  };

  const result = sheet
    ? mode === "add"
      ? rowsToCreateInputs(sheet.rows, mapping)
      : rowsToUpdateInputs(sheet.rows, mapping, existing)
    : null;

  const count = result?.inputs.length ?? 0;
  const save = async () => {
    if (!result || result.errors.length || !result.inputs.length) return;
    setSaving(true);
    setError("");
    try {
      const saved =
        mode === "add"
          ? await rpc.equity.stakeholderActions.bulkCreate({ rows: rowsAsCreate(result) })
          : await rpc.equity.stakeholderActions.bulkUpdate({ rows: rowsAsUpdate(result) });
      onOpenChange(false);
      onDone(saved.items.length);
    } catch (cause) {
      setError(errorText(cause));
    } finally {
      setSaving(false);
    }
  };

  const fieldOptions: [ImportField, string][] = [
    ["", t`Leave out`],
    ...TEMPLATE_FIELDS.filter(([field]) => mode === "update" || field !== "id").map(
      ([field, label]) => [field, label] as [ImportField, string],
    ),
    ...customProperties.map(
      (property) => [`custom:${property.id}`, property.name] as [ImportField, string],
    ),
  ];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>
            {mode === "add" ? t`Bulk add stakeholders` : t`Bulk update stakeholders`}
          </DialogTitle>
        </DialogHeader>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() =>
              downloadText(
                "stakeholders-template.csv",
                templateCsv(customProperties, mode === "update"),
              )
            }
          >{t`Download template`}</Button>
          <Button size="sm" onClick={() => picker.current?.click()}>
            {t`Choose spreadsheet`}
          </Button>
          {sheet && <span className="text-sm text-muted-foreground">{sheet.name}</span>}
          <input
            ref={picker}
            type="file"
            accept=".csv,text/csv"
            aria-label={t`Spreadsheet`}
            className="hidden"
            onChange={(event) => read(event.target.files?.[0])}
          />
        </div>
        {sheet && (
          <>
            <Table>
              <TableHeader>
                <TableHeadRow>
                  <TableHead>{t`Column`}</TableHead>
                  <TableHead>{t`Field`}</TableHead>
                </TableHeadRow>
              </TableHeader>
              <TableBody>
                {sheet.headers.map((header, index) => (
                  <TableRow key={`${header}-${index}`}>
                    <TableCell>{header}</TableCell>
                    <TableCell>
                      <NativeSelect
                        aria-label={t`Field for ${header}`}
                        value={mapping[index] ?? ""}
                        onChange={(event) =>
                          setMapping((now) =>
                            now.map((field, i) =>
                              i === index ? (event.target.value as ImportField) : field,
                            ),
                          )
                        }
                      >
                        {fieldOptions.map(([field, label]) => (
                          <NativeSelectOption key={field || "none"} value={field}>
                            {label}
                          </NativeSelectOption>
                        ))}
                      </NativeSelect>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            {result && result.errors.length > 0 ? (
              <ul className="text-sm text-destructive">
                {result.errors.slice(0, 20).map((rowError) => (
                  <li
                    key={`${rowError.row}-${rowError.message}`}
                  >{t`Row ${rowError.row}: ${rowError.message}`}</li>
                ))}
              </ul>
            ) : (
              <p className="text-sm">
                {mode === "add"
                  ? count === 1
                    ? t`1 stakeholder to add`
                    : t`${count} stakeholders to add`
                  : count === 1
                    ? t`1 stakeholder to update`
                    : t`${count} stakeholders to update`}
              </p>
            )}
          </>
        )}
        {error && <p className="text-sm text-destructive">{error}</p>}
        <DialogFooter>
          <Button
            disabled={saving || !result || result.errors.length > 0 || result.inputs.length === 0}
            onClick={save}
          >
            {mode === "add" ? t`Add stakeholders` : t`Update stakeholders`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

const rowsAsCreate = (
  result: ReturnType<typeof rowsToCreateInputs> | ReturnType<typeof rowsToUpdateInputs>,
) => result.inputs as ReturnType<typeof rowsToCreateInputs>["inputs"];
const rowsAsUpdate = (
  result: ReturnType<typeof rowsToCreateInputs> | ReturnType<typeof rowsToUpdateInputs>,
) => result.inputs as ReturnType<typeof rowsToUpdateInputs>["inputs"];
