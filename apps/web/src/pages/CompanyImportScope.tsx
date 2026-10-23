import { t } from "@lingui/core/macro";
import { Trans } from "@lingui/react/macro";
import type { CompanyImportCatalogSource } from "@rakazo/contracts";
import { CompanyDataRoomScopeSchema, CompanyMailScopeSchema } from "@rakazo/contracts";
import { Button, Checkbox, Dialog, DialogContent, DialogTitle, Input } from "@rakazo/ui-web";
import { useRef, useState } from "react";

export function CompanyImportScope({
  source,
  scope,
  folders,
  onClose,
  onSave,
}: {
  source: CompanyImportCatalogSource;
  scope: Record<string, unknown>;
  folders: { id: string; name: string }[];
  onClose: () => void;
  onSave: (scope: Record<string, unknown>) => void;
}) {
  const popup = useRef<HTMLDivElement>(null);
  const [allFolders, setAllFolders] = useState(scope.folderIds === undefined);
  const [selected, setSelected] = useState<string[]>(
    Array.isArray(scope.folderIds) ? scope.folderIds : [],
  );
  const [after, setAfter] = useState(String(scope.after ?? ""));
  const [before, setBefore] = useState(String(scope.before ?? ""));
  const [allTime, setAllTime] = useState(scope.allTime === true);
  const [labels, setLabels] = useState(
    Array.isArray(scope.labelIds) ? scope.labelIds.join(", ") : "",
  );
  const [invalid, setInvalid] = useState(false);
  function save() {
    const result =
      source.sourceKind === "data_room"
        ? CompanyDataRoomScopeSchema.safeParse({
            ...scope,
            folderIds: allFolders ? undefined : selected,
          })
        : CompanyMailScopeSchema.safeParse({
            allTime,
            ...(!allTime && after ? { after } : {}),
            ...(before ? { before } : {}),
            ...(labels.trim()
              ? {
                  labelIds: labels
                    .split(",")
                    .map((label) => label.trim())
                    .filter(Boolean),
                }
              : {}),
          });
    if (!result.success || (source.sourceKind === "data_room" && !allFolders && !selected.length)) {
      setInvalid(true);
      return;
    }
    onSave(result.data);
  }
  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent
        ref={popup}
        initialFocus={popup}
        tabIndex={-1}
        className="inset-y-0 left-auto right-0 h-full max-h-screen w-full translate-x-0 translate-y-0 content-start overflow-y-auto rounded-none sm:max-w-lg"
      >
        <DialogTitle>
          <Trans>Choose scope</Trans> · {source.label}
        </DialogTitle>
        <form
          className="space-y-5"
          onSubmit={(event) => {
            event.preventDefault();
            save();
          }}
        >
          {source.sourceKind === "data_room" ? (
            <fieldset className="space-y-4">
              <legend className="mb-3 font-medium">
                <Trans>Folders</Trans>
              </legend>
              <div className="flex items-center gap-3">
                <Checkbox
                  aria-label={t`All folders`}
                  checked={allFolders}
                  onCheckedChange={setAllFolders}
                />
                <Trans>All folders</Trans>
              </div>
              {!allFolders &&
                folders.map((folder) => (
                  <div key={folder.id} className="flex items-center gap-3">
                    <Checkbox
                      aria-label={folder.name}
                      checked={selected.includes(folder.id)}
                      onCheckedChange={(checked) =>
                        setSelected((ids) =>
                          checked ? [...ids, folder.id] : ids.filter((id) => id !== folder.id),
                        )
                      }
                    />
                    {folder.name}
                  </div>
                ))}
            </fieldset>
          ) : (
            <fieldset className="space-y-4">
              <legend className="mb-3 font-medium">
                <Trans>Date window</Trans>
              </legend>
              <div className="flex items-center gap-3">
                <Checkbox aria-label={t`All time`} checked={allTime} onCheckedChange={setAllTime} />
                <Trans>All time</Trans>
              </div>
              {!allTime && (
                <label htmlFor="company-import-scope-after" className="grid gap-2">
                  <Trans>From</Trans>
                  <Input
                    id="company-import-scope-after"
                    type="date"
                    value={after}
                    onChange={(e) => setAfter(e.target.value)}
                  />
                </label>
              )}
              <label htmlFor="company-import-scope-before" className="grid gap-2">
                <Trans>Before</Trans>
                <Input
                  id="company-import-scope-before"
                  type="date"
                  value={before}
                  onChange={(e) => setBefore(e.target.value)}
                />
              </label>
              <label htmlFor="company-import-scope-labels" className="grid gap-2">
                <Trans>Label IDs</Trans>
                <Input
                  id="company-import-scope-labels"
                  value={labels}
                  onChange={(e) => setLabels(e.target.value)}
                  placeholder={t`INBOX, SENT`}
                />
              </label>
            </fieldset>
          )}
          {invalid && (
            <p role="alert" className="text-destructive">
              <Trans>Choose a valid scope</Trans>
            </p>
          )}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={onClose}>
              <Trans>Cancel</Trans>
            </Button>
            <Button type="submit">
              <Trans>Save</Trans>
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
