import { Trans, useLingui } from "@lingui/react/macro";
import type { SidebarPagesState, SidebarPageTemplate } from "@rakazo/contracts";
import { SIDEBAR_PAGE_TEMPLATES } from "@rakazo/contracts";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@rakazo/ui-web";
import { Ellipsis, LayoutDashboard } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { matchPath, useLocation, useNavigate } from "react-router-dom";
import { rpc } from "../lib/rpc";
import { sidebarPageCopy } from "../lib/sidebar-page-copy";
import { errorText } from "../lib/user-error";
import { AddSidebarPage } from "./AddSidebarPage";
import { SidebarPageLink } from "./SidebarPageLink";

/** The user's added sidebar pages, then the "+ Add page" row. */
export function SidebarPages({
  templates = SIDEBAR_PAGE_TEMPLATES,
  onOpen,
}: {
  templates?: readonly SidebarPageTemplate[];
  onOpen?: () => void;
}) {
  const { t } = useLingui();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const [state, setState] = useState<SidebarPagesState | null>(null);
  const [error, setError] = useState("");
  const pathRef = useRef(pathname);
  pathRef.current = pathname;
  // Counts mutations, so only the latest response (and no initial list) is applied after one.
  const latest = useRef(0);

  useEffect(() => {
    // Nothing can be added in this build, so there is nothing to load.
    if (!templates.some((template) => template.available)) return;
    let active = true;
    const seen = latest.current;
    void rpc.sidebarPages
      .list()
      .then((next) => active && latest.current === seen && setState(next))
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [templates]);

  /** Runs a mutation and applies its response unless a newer mutation started; true if the request succeeded. */
  const mutate = useCallback(async (run: () => Promise<SidebarPagesState>) => {
    const mine = ++latest.current;
    setError("");
    try {
      const next = await run();
      if (latest.current === mine) setState(next);
      return true;
    } catch (cause) {
      if (latest.current === mine) setError(errorText(cause));
      return false;
    }
  }, []);

  const add = (templateKey: string) => mutate(() => rpc.sidebarPages.add({ templateKey }));

  const remove = async (template: SidebarPageTemplate) => {
    const removed = await mutate(() => rpc.sidebarPages.remove({ templateKey: template.key }));
    if (removed && matchPath({ path: template.route, end: false }, pathRef.current)) {
      navigate("/app");
    }
  };

  const added = state?.pages.map((page) => page.templateKey) ?? [];
  const rows = added.flatMap((key) => templates.find((template) => template.key === key) ?? []);
  const addable = templates.filter((template) => state?.addable.includes(template.key));

  return (
    <>
      {rows.map((template) => (
        <div key={template.key} className="group relative">
          <SidebarPageLink
            testId={`sidebar-page-${template.key}`}
            current={matchPath({ path: template.route, end: false }, pathname) != null}
            icon={<LayoutDashboard size={15} strokeWidth={1.8} aria-hidden="true" />}
            label={t(sidebarPageCopy(template.key).label)}
            onOpen={() => {
              onOpen?.();
              navigate(template.route);
            }}
          />
          <DropdownMenu>
            <DropdownMenuTrigger
              aria-label={t`Page options`}
              className="absolute end-4 top-1/2 grid h-6 w-6 -translate-y-1/2 place-items-center rounded-md text-muted-foreground opacity-0 hover:bg-accent focus-visible:opacity-100 group-hover:opacity-100 data-[popup-open]:opacity-100"
            >
              <Ellipsis size={15} strokeWidth={1.8} aria-hidden="true" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => void remove(template)}>
                <Trans>Remove from sidebar</Trans>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      ))}
      <AddSidebarPage templates={addable} onAdd={(key) => void add(key)} />
      {error ? (
        <p role="alert" className="mx-5 mb-1 text-xs text-destructive">
          {error}
        </p>
      ) : null}
    </>
  );
}
