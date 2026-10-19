import { t } from "@lingui/core/macro";
import type { DataRoomApiDriveFile } from "@rakazo/contracts";
import { Checkbox } from "@rakazo/ui-web";
import { Folder } from "lucide-react";
import { sizeText } from "./format";

/**
 * One Drive file or folder in the import picker. The checkbox shows on hover and keyboard focus,
 * and always once ticked or on touch screens. The rest of a folder row opens the folder.
 */
export function DriveRow({
  file,
  checked,
  disabled,
  onToggle,
  onOpen,
}: {
  file: DataRoomApiDriveFile;
  checked: boolean;
  disabled: boolean;
  onToggle: () => void;
  onOpen: () => void;
}) {
  const label = (
    <>
      {file.isFolder ? <Folder className="size-4 shrink-0" aria-hidden="true" /> : null}
      <span className="min-w-0 flex-1 truncate">{file.name}</span>
      {file.size === undefined ? null : (
        <span className="text-xs text-muted-foreground">{sizeText(file.size)}</span>
      )}
    </>
  );
  return (
    <div className="group flex items-center gap-2 px-3 py-2 text-sm hover:bg-muted">
      <Checkbox
        aria-label={t`Select ${file.name}`}
        disabled={disabled}
        checked={checked}
        onCheckedChange={onToggle}
        className="opacity-0 group-hover:opacity-100 focus-visible:opacity-100 data-checked:opacity-100 [@media(hover:none)]:opacity-100"
      />
      {file.isFolder ? (
        <button
          type="button"
          onClick={onOpen}
          className="flex min-w-0 flex-1 items-center gap-2 text-start"
        >
          {label}
        </button>
      ) : (
        <div className="flex min-w-0 flex-1 items-center gap-2">{label}</div>
      )}
    </div>
  );
}
