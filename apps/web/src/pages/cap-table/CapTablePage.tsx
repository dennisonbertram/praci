import { t } from "@lingui/core/macro";
import { Tabs, TabsList, TabsTrigger } from "@rakazo/ui-web";
import { Navigate, useLocation, useMatch, useNavigate } from "react-router-dom";
import { PAGE_GUTTER_X, PageHeader } from "../../components/PageHeader";
import { CAP_TABLE_TAB_IDS, CAP_TABLE_TABS, capTableTab } from "./tabs";

/**
 * The cap table pages. The shell mounts this at /app/cap-table/*; the tab is the first path
 * segment, so the address is the state and every tab is linkable.
 */
export function CapTablePage() {
  const nested = useMatch("/app/cap-table/:tab/*");
  const single = useMatch("/app/cap-table/:tab");
  const location = useLocation();
  const navigate = useNavigate();
  const asked = nested?.params.tab ?? single?.params.tab;

  // The old cap table combined Carta holding and contact filters. Auditors still
  // have an exact filter on Contacts; the retired Carta filters fall back to the
  // current Investors overview instead of pretending the selection was applied.
  const legacyKind = new URLSearchParams(location.search).get("kind");
  if (asked == null && legacyKind === "auditor")
    return <Navigate to={`/app/contacts${location.search}`} replace />;
  if (asked == null && ["shareholder", "options"].includes(legacyKind ?? ""))
    return <Navigate to="/app/investors" replace />;

  // /app/cap-table and an unknown first segment both land on Overview.
  if (asked == null || !(CAP_TABLE_TAB_IDS as string[]).includes(asked))
    return <Navigate to="/app/cap-table/overview" replace />;

  const tab = capTableTab(asked);
  return (
    <div
      className={`rk-scroll flex min-h-0 min-w-0 flex-1 flex-col gap-4 overflow-y-auto ${PAGE_GUTTER_X} pb-6`}
    >
      <PageHeader title={t`Cap table`} />
      <Tabs value={tab.id} onValueChange={(next) => navigate(`/app/cap-table/${next}`)}>
        <TabsList
          className="no-scrollbar max-w-full justify-start overflow-x-auto overflow-y-hidden rounded-full"
          aria-label={t`Sections`}
        >
          {CAP_TABLE_TABS.map((entry) => (
            <TabsTrigger key={entry.id} value={entry.id} className="rounded-full px-3">
              {entry.label()}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>
      {tab.element}
    </div>
  );
}
