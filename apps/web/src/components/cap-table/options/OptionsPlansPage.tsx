import { t } from "@lingui/core/macro";
import type { EquityOptionGrant, EquityPlanPool } from "@rakazo/contracts";
import { Tabs, TabsList, TabsTrigger } from "@rakazo/ui-web";
import { useEffect, useState } from "react";
import { useMatch, useNavigate, useSearchParams } from "react-router-dom";
import { rpc } from "../../../lib/rpc";
import { Iso100kDialog } from "./Iso100kDialog";
import { OptionBulkCancelDialog } from "./OptionBulkCancelDialog";
import { OptionDraftSetDialog } from "./OptionDraftSetDialog";
import type { OptionGrantTransaction } from "./OptionGrantActionDialog";
import { OPTION_GRANT_TRANSACTIONS, OptionGrantActionDialog } from "./OptionGrantActionDialog";
import type { OptionGrantChange } from "./OptionGrantChangeDialog";
import { OPTION_GRANT_CHANGES, OptionGrantChangeDialog } from "./OptionGrantChangeDialog";
import { OptionGrantRecord } from "./OptionGrantRecord";
import type { OptionGrantAction } from "./OptionGrantsTable";
import { OptionGrantsTable } from "./OptionGrantsTable";
import { OptionRepriceDialog } from "./OptionRepriceDialog";
import { PlanPoolDialog } from "./PlanPoolDialog";
import { PlansTable } from "./PlansTable";
import { RsaTable } from "./RsaTable";
import { VestingTemplatesTable } from "./VestingTemplatesTable";
import { WarrantsTable } from "./WarrantsTable";

const VIEWS = ["equity-plans", "grants", "vesting-templates", "rsas", "warrants"] as const;
type View = (typeof VIEWS)[number];

const isTransaction = (action: OptionGrantAction): action is OptionGrantTransaction =>
  (OPTION_GRANT_TRANSACTIONS as readonly string[]).includes(action);

/** The Plans tab: equity plans, option grants and vesting templates, one sub-path each. */
export function OptionsPlansPage() {
  const match = useMatch("/app/cap-table/plans/:view");
  const navigate = useNavigate();
  const view: View = (VIEWS as readonly string[]).includes(match?.params.view ?? "")
    ? (match?.params.view as View)
    : "equity-plans";
  const [pending, setPending] = useState<{
    action: OptionGrantTransaction;
    grant: EquityOptionGrant;
  } | null>(null);
  const [pool, setPool] = useState<{
    mode: "increase" | "pourOver";
    planId: string;
    pools: EquityPlanPool[];
  } | null>(null);
  const [drafting, setDrafting] = useState(false);
  const [bulkCancel, setBulkCancel] = useState<EquityOptionGrant[] | null>(null);
  const [reprice, setReprice] = useState<EquityOptionGrant[] | null>(null);
  const [iso100k, setIso100k] = useState(false);
  const [open, setOpen] = useState<EquityOptionGrant | null>(null);
  const [change, setChange] = useState<{
    action: OptionGrantChange;
    grant: EquityOptionGrant;
  } | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  // Links from other tabs (a holder's holdings, a health finding) open one grant: ?grant=<id>.
  const [params] = useSearchParams();
  const linked = params.get("grant");
  useEffect(() => {
    if (!linked) return;
    let live = true;
    rpc.equity.optionGrants
      .get({ id: linked })
      .then((grant) => live && setOpen(grant))
      .catch(() => {});
    return () => {
      live = false;
    };
  }, [linked]);

  function onAction(action: OptionGrantAction, grant: EquityOptionGrant) {
    if (isTransaction(action)) setPending({ action, grant });
    else if ((OPTION_GRANT_CHANGES as readonly string[]).includes(action))
      setChange({ action: action as OptionGrantChange, grant });
    else if (action === "print") {
      setOpen(grant);
      setTimeout(() => window.print(), 300);
    } else if (action === "viewStakeholder")
      navigate(`/app/cap-table/stakeholders/${grant.stakeholderId}`);
  }

  return (
    <div className="flex flex-col gap-4">
      <Tabs value={view} onValueChange={(next) => navigate(`/app/cap-table/plans/${next}`)}>
        <TabsList aria-label={t`Plans sections`}>
          <TabsTrigger value="equity-plans">{t`Equity plans`}</TabsTrigger>
          <TabsTrigger value="grants">{t`Option grants`}</TabsTrigger>
          <TabsTrigger value="vesting-templates">{t`Vesting templates`}</TabsTrigger>
          <TabsTrigger value="rsas">{t`RSAs`}</TabsTrigger>
          <TabsTrigger value="warrants">{t`Warrants`}</TabsTrigger>
        </TabsList>
      </Tabs>
      {view === "equity-plans" && (
        <PlansTable
          refreshKey={refreshKey}
          onIncrease={(target, pools) =>
            setPool({ mode: "increase", planId: target.planId, pools })
          }
          onPourOver={(pools) =>
            setPool({ mode: "pourOver", planId: pools[0]?.planId ?? "", pools })
          }
        />
      )}
      {pool && (
        <PlanPoolDialog
          mode={pool.mode}
          pools={pool.pools}
          planId={pool.planId}
          onClose={() => setPool(null)}
          onDone={() => {
            setPool(null);
            setRefreshKey((key) => key + 1);
          }}
        />
      )}
      {view === "grants" && (
        <OptionGrantsTable
          key={refreshKey}
          onOpen={setOpen}
          onAction={onAction}
          onDraft={() => setDrafting(true)}
          onBulkCancel={setBulkCancel}
          onBulkReprice={setReprice}
          onIso100k={() => setIso100k(true)}
        />
      )}
      {view === "vesting-templates" && <VestingTemplatesTable />}
      {view === "rsas" && <RsaTable />}
      {view === "warrants" && <WarrantsTable />}
      {open && <OptionGrantRecord grant={open} onClose={() => setOpen(null)} />}
      {change && (
        <OptionGrantChangeDialog
          action={change.action}
          grant={change.grant}
          onClose={() => setChange(null)}
          onDone={() => {
            setChange(null);
            setRefreshKey((key) => key + 1);
          }}
        />
      )}
      {iso100k && <Iso100kDialog onClose={() => setIso100k(false)} />}
      {reprice && (
        <OptionRepriceDialog
          grants={reprice}
          onClose={() => setReprice(null)}
          onDone={() => {
            setReprice(null);
            setRefreshKey((key) => key + 1);
          }}
        />
      )}
      {bulkCancel && (
        <OptionBulkCancelDialog
          grants={bulkCancel}
          onClose={() => setBulkCancel(null)}
          onDone={() => {
            setBulkCancel(null);
            setRefreshKey((key) => key + 1);
          }}
        />
      )}
      {drafting && (
        <OptionDraftSetDialog
          onClose={() => setDrafting(false)}
          onSaved={() => {
            setDrafting(false);
            setRefreshKey((key) => key + 1);
          }}
        />
      )}
      {pending && (
        <OptionGrantActionDialog
          action={pending.action}
          grant={pending.grant}
          onClose={() => setPending(null)}
          onDone={() => {
            setPending(null);
            setRefreshKey((key) => key + 1);
          }}
        />
      )}
    </div>
  );
}
