import { t } from "@lingui/core/macro";
import type { EquitySavedView } from "@rakazo/contracts";
import {
  Button,
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

/** Named copies of the overview's query string: as-of date, tab and fully diluted. */
export function OverviewSavedViews() {
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
      .then((page) => setViews(page.items.filter((view) => view.page === "overview")))
      .catch(() => setViews([]));
  }, [reload]);

  const save = async (event: FormEvent) => {
    event.preventDefault();
    try {
      await rpc.equity.savedViews.create({
        page: "overview",
        name: name.trim(),
        params: params.toString(),
      });
      setNaming(false);
      setName("");
      setReload((count) => count + 1);
    } catch (cause) {
      setError(errorText(cause));
    }
  };

  return (
    <div className="flex flex-col gap-2">
      <DropdownMenu>
        <DropdownMenuTrigger render={<Button variant="outline" size="sm" />}>
          {t`Views`}
          <ChevronDown aria-hidden="true" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start">
          <DropdownMenuItem
            onClick={() => {
              setError("");
              setNaming(true);
            }}
          >
            {t`Save view`}
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
      {naming ? (
        <form className="flex flex-wrap items-center gap-2" onSubmit={save}>
          <Input
            aria-label={t`View name`}
            placeholder={t`View name`}
            className="w-40"
            value={name}
            onChange={(event) => setName(event.target.value)}
          />
          <Button type="submit" variant="outline" size="sm" disabled={!name.trim()}>
            {t`Save`}
          </Button>
          {error ? (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          ) : null}
        </form>
      ) : null}
    </div>
  );
}
