import { t } from "@lingui/core/macro";
import type { EquitySavedView } from "@rakazo/contracts";
import {
  Button,
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  Input,
} from "@rakazo/ui-web";
import { ChevronDown } from "lucide-react";
import type { FormEvent } from "react";
import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { rpc } from "../../../lib/rpc";
import { errorText } from "../../../lib/user-error";

/** Named copies of the list's query string: filters, search, sort and columns. */
export function SavedViewsMenu() {
  const [params, setParams] = useSearchParams();
  const [views, setViews] = useState<EquitySavedView[]>([]);
  const [naming, setNaming] = useState(false);
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const [reload, setReload] = useState(0);

  useEffect(() => {
    rpc.equity.savedViews
      // The list input's `page` is the page number, so the view page is filtered here.
      .list({ pageSize: 500, sort: { field: "name", dir: "asc" } })
      .then((page) => setViews(page.items.filter((view) => view.page === "stakeholders")))
      .catch(() => setViews([]));
  }, [reload]);

  const save = async (event: FormEvent) => {
    event.preventDefault();
    try {
      await rpc.equity.savedViews.create({
        page: "stakeholders",
        name: name.trim(),
        params: params.toString(),
      });
      setNaming(false);
      setName("");
      setReload((n) => n + 1);
    } catch (cause) {
      setError(errorText(cause));
    }
  };

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger render={<Button variant="outline" size="sm" />}>
          {t`Saved views`}
          <ChevronDown aria-hidden="true" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start">
          <DropdownMenuItem
            onClick={() => {
              setError("");
              setNaming(true);
            }}
          >
            {t`Save this filtered view as…`}
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          {views.length === 0 ? (
            <DropdownMenuItem disabled>{t`No saved views`}</DropdownMenuItem>
          ) : (
            views.map((view) => (
              <DropdownMenuItem
                key={view.id}
                onClick={() => setParams(new URLSearchParams(view.params), { replace: true })}
              >
                {view.name}
              </DropdownMenuItem>
            ))
          )}
        </DropdownMenuContent>
      </DropdownMenu>
      <Dialog open={naming} onOpenChange={setNaming}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t`Save view`}</DialogTitle>
          </DialogHeader>
          <form id="save-view" onSubmit={save}>
            <Input
              aria-label={t`View name`}
              placeholder={t`View name`}
              value={name}
              onChange={(event) => setName(event.target.value)}
            />
          </form>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <DialogFooter>
            <Button type="submit" form="save-view" disabled={!name.trim()}>{t`Save`}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
