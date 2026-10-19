import { t } from "@lingui/core/macro";
import { Trans } from "@lingui/react/macro";
import { Button } from "@rakazo/ui-web";
import { Plus } from "lucide-react";
import { useRef } from "react";
import { ensureDataRoomFolder } from "../../lib/data-room";
import { errorText } from "../../lib/user-error";
import { Tip, TOOLBAR_BUTTON, TOOLBAR_LABEL } from "./FilterBar";
import { ImportSources } from "./ImportFromEmail";
import { showNoticeToast, uploadFilesToDataRoom } from "./upload-toasts";

/**
 * The Import menu (Email, Google Drive, Box) and "Add files" for pages outside the Data room.
 * Everything is filed into the Data room folder at `folderPath` (names from the top level down),
 * which is created the first time it is needed.
 */
export function DataRoomImportMenu({
  folderPath,
  onDone,
}: {
  folderPath: string[];
  onDone: (message: string, changed: boolean) => void;
}) {
  const input = useRef<HTMLInputElement>(null);
  const ensureFolder = () => ensureDataRoomFolder(folderPath);
  return (
    <>
      <ImportSources compact folderId={null} ensureFolder={ensureFolder} onDone={onDone} />
      <input
        ref={input}
        type="file"
        multiple
        hidden
        data-testid="data-room-file-input"
        onChange={(event) => {
          const files = Array.from(event.target.files ?? []);
          event.target.value = "";
          ensureFolder()
            .then((id) => uploadFilesToDataRoom(files, id))
            .catch((cause) => showNoticeToast(errorText(cause)));
        }}
      />
      <Tip label={t`Add files`} side="left">
        <Button variant="outline" className={TOOLBAR_BUTTON} onClick={() => input.current?.click()}>
          <Plus aria-hidden="true" />
          <span className={TOOLBAR_LABEL}>
            <Trans>Add files</Trans>
          </span>
        </Button>
      </Tip>
    </>
  );
}
