import { Trans } from "@lingui/react/macro";
import type { DataRoomApiItem } from "@rakazo/contracts";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableHeadRow,
  TableRow,
} from "@rakazo/ui-web";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { DATA_ROOM_CHANGED, dataRoomItemPath, findDataRoomFolder } from "../../lib/data-room";
import { maskCurrencyWhenHidden, useHideAmounts } from "../../lib/hide-amounts-preference";
import { rpc } from "../../lib/rpc";
import { dateText, typeLabel } from "./format";

const LIMIT = 10;

/**
 * The newest documents in the Data room folder at `folderPath`. Each row opens the Data room
 * preview. Nothing shows while the folder is missing, empty or unreadable. It reloads after
 * uploads and imports.
 */
export function FolderDocuments({ folderPath }: { folderPath: string[] }) {
  useHideAmounts();
  const [items, setItems] = useState<DataRoomApiItem[]>([]);
  const key = folderPath.join("/");
  useEffect(() => {
    let current = true;
    const load = async () => {
      const folderId = findDataRoomFolder(await rpc.dataRoom.folders(), folderPath);
      if (!folderId) return [];
      const page = await rpc.dataRoom.items.list({
        folderId,
        sort: { field: "createdAt", direction: "desc" },
        limit: LIMIT,
      });
      return page.items;
    };
    const reload = () =>
      load()
        .then((next) => current && setItems(next))
        .catch(() => current && setItems([]));
    void reload();
    window.addEventListener(DATA_ROOM_CHANGED, reload);
    return () => {
      current = false;
      window.removeEventListener(DATA_ROOM_CHANGED, reload);
    };
  }, [key]);
  if (items.length === 0) return null;
  return (
    <section className="mt-8">
      <h2 className="mb-2 text-sm font-medium">
        <Trans>Documents</Trans>
      </h2>
      <Table>
        <TableHeader>
          <TableHeadRow>
            <TableHead>
              <Trans>Name</Trans>
            </TableHead>
            <TableHead className="hidden w-32 @md:table-cell">
              <Trans>Type</Trans>
            </TableHead>
            <TableHead className="w-28 pe-0 text-end">
              <Trans>Added</Trans>
            </TableHead>
          </TableHeadRow>
        </TableHeader>
        <TableBody>
          {items.map((item) => {
            const name = maskCurrencyWhenHidden(item.name);
            return (
              <TableRow key={item.id}>
                <TableCell>
                  <Link
                    to={dataRoomItemPath(item.id)}
                    title={name}
                    className="block truncate font-medium hover:underline focus-visible:underline focus-visible:outline-none"
                  >
                    {name}
                  </Link>
                </TableCell>
                <TableCell className="hidden text-muted-foreground @md:table-cell">
                  {typeLabel(item.facets.docType)}
                </TableCell>
                <TableCell className="pe-0 text-end text-muted-foreground">
                  {dateText(item.createdAt)}
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </section>
  );
}
