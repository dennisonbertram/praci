import { Trans, useLingui } from "@lingui/react/macro";
import type {
  Bot,
  SidebarPageInput,
  SidebarPagesState,
  SidebarPageTemplate,
} from "@rakazo/contracts";
import { SIDEBAR_PAGE_TEMPLATES } from "@rakazo/contracts";
import {
  BotAvatar,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@rakazo/ui-web";
import { Ellipsis, LayoutDashboard } from "lucide-react";
import type { ReactNode } from "react";
import { useCallback, useEffect, useRef, useState } from "react";
import { matchPath, useLocation, useNavigate } from "react-router-dom";
import { desktopBridge } from "../lib/desktop";
import { rpc } from "../lib/rpc";
import { sidebarPageCopy } from "../lib/sidebar-page-copy";
import { SIDEBAR_PAGES_CHANGED_EVENT } from "../lib/sidebar-pages-event";
import { errorText } from "../lib/user-error";
import { AddSidebarPage } from "./AddSidebarPage";
import { SidebarPageLink } from "./SidebarPageLink";
import { usePagesCollapsed } from "./SidebarPagesGroup";

export { SIDEBAR_PAGES_CHANGED_EVENT };

/** The user's added sidebar pages, then the "+ Add page" row. */
export function SidebarPages({
  templates = SIDEBAR_PAGE_TEMPLATES,
  onOpen,
  rail = false,
  hidden = [],
  onListed,
  bots = [],
}: {
  /** The user's bots: a bot page shows its bot's avatar, and the add menu names the bot. */
  bots?: readonly Pick<Bot, "id" | "name" | "color" | "status">[];
  hidden?: readonly string[];
  /** Reports the added pages, so the group's menu can offer them too. */
  onListed?: (pages: { key: string; label: string }[]) => void;
  templates?: readonly SidebarPageTemplate[];
  onOpen?: () => void;
  rail?: boolean;
}) {
  const { t } = useLingui();
  const collapsed = usePagesCollapsed();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const [state, setState] = useState<SidebarPagesState | null>(null);
  const [error, setError] = useState("");
  const pathRef = useRef(pathname);
  pathRef.current = pathname;
  // Counts mutations, so only the latest response (and no initial list) is applied after one.
  const latest = useRef(0);

  useEffect(() => {
    let active = true;
    const load = () => {
      const seen = latest.current;
      void rpc.sidebarPages
        .list()
        .then((next) => active && latest.current === seen && setState(next))
        .catch((cause) => active && setError(errorText(cause)));
    };
    load();
    window.addEventListener(SIDEBAR_PAGES_CHANGED_EVENT, load);
    return () => {
      active = false;
      window.removeEventListener(SIDEBAR_PAGES_CHANGED_EVENT, load);
    };
  }, []);

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

  const surface = desktopBridge() ? "desktop" : "web";
  type Row = {
    key: string;
    label: string;
    route: string;
    icon: ReactNode;
    input: SidebarPageInput;
  };
  const rows = (state?.pages ?? []).flatMap((page): Row[] => {
    if ("pageId" in page) {
      const bot = bots.find((candidate) => candidate.id === page.botId);
      return [
        {
          key: `page:${page.pageId}`,
          label: page.title,
          route: `/app/pages/${page.botId}/${page.pageId}`,
          icon: (
            <BotAvatar
              color={bot?.color ?? ""}
              identity={page.botId}
              size={24}
              status={bot?.status}
            />
          ),
          input: { pageId: page.pageId },
        },
      ];
    }
    const template = templates.find((candidate) => candidate.key === page.templateKey);
    return template?.available && template.platforms.includes(surface)
      ? [
          {
            key: template.key,
            label: t(sidebarPageCopy(template.key).label),
            route: template.route,
            icon: <LayoutDashboard size={15} strokeWidth={1.8} aria-hidden="true" />,
            input: { templateKey: template.key },
          },
        ]
      : [];
  });

  const open = async (input: SidebarPageInput, route: string) => {
    const added = await mutate(() => rpc.sidebarPages.add(input));
    if (added) {
      onOpen?.();
      navigate(route);
    }
  };

  const remove = async (row: Row) => {
    const removed = await mutate(() => rpc.sidebarPages.remove(row.input));
    if (removed && matchPath({ path: row.route, end: false }, pathRef.current)) {
      navigate("/app");
    }
  };

  const listed = rows.map(({ key, label }) => ({ key, label }));
  const listedKey = listed.map((page) => `${page.key}:${page.label}`).join("|");
  useEffect(() => onListed?.(listed), [listedKey, onListed]);
  const isCurrent = (row: Row) => matchPath({ path: row.route, end: false }, pathname) != null;
  const addable = templates.filter((template) => state?.addable.includes(template.key));
  const addableBotPages = (state?.botPages ?? []).flatMap(({ botId, pages }) => {
    const bot = bots.find((candidate) => candidate.id === botId);
    return bot ? [{ bot, pages }] : [];
  });

  return (
    <>
      {rows.map((row) =>
        hidden.includes(row.key) || (collapsed && !isCurrent(row)) ? null : (
          <div key={row.key} className="group relative flex flex-col">
            <SidebarPageLink
              testId={`sidebar-page-${row.key}`}
              current={isCurrent(row)}
              icon={row.icon}
              label={row.label}
              rail={rail}
              onOpen={() => {
                onOpen?.();
                navigate(row.route);
              }}
            />
            {rail ? null : (
              <DropdownMenu>
                <DropdownMenuTrigger
                  aria-label={t`Page options`}
                  className="absolute end-4 top-1/2 grid h-6 w-6 -translate-y-1/2 place-items-center rounded-md text-muted-foreground opacity-0 pointer-coarse:opacity-100 hover:bg-accent focus-visible:opacity-100 group-hover:opacity-100 data-[popup-open]:opacity-100"
                >
                  <Ellipsis size={15} strokeWidth={1.8} aria-hidden="true" />
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => void remove(row)}>
                    <Trans>Remove from sidebar</Trans>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>
        ),
      )}
      <AddSidebarPage
        templates={rail || collapsed ? [] : addable}
        botPages={rail || collapsed ? [] : addableBotPages}
        onAdd={(key) => {
          const template = templates.find((candidate) => candidate.key === key);
          if (template) void open({ templateKey: key }, template.route);
        }}
        onAddPage={(pageId) => {
          const group = addableBotPages.find((entry) =>
            entry.pages.some((page) => page.id === pageId),
          );
          if (group) void open({ pageId }, `/app/pages/${group.bot.id}/${pageId}`);
        }}
        onOpenMenu={() => setError("")}
      />
      {error ? (
        <p role="alert" className="mx-5 mb-1 text-xs text-destructive">
          {error}
        </p>
      ) : null}
    </>
  );
}
