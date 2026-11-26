import { t } from "@lingui/core/macro";
import { Trans } from "@lingui/react/macro";
import { Button, Skeleton, Tabs, TabsList, TabsTrigger } from "@rakazo/ui-web";
import { useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { rpc } from "../../lib/rpc";
import { useFinanceQuery } from "../finance/ui";
import { AppLogo } from "../integrations/AppLogo";
import { BrexCardsConnectDialog } from "../integrations/BrexCardsConnectDialog";
import { PageEmptyState } from "../PageEmptyState";
import { PageHeader } from "../PageHeader";
import { StillLoading } from "../ShellSkeleton";
import { BrexAccounts } from "./BrexAccounts";
import { BrexActivity } from "./BrexActivity";
import { BrexCards } from "./BrexCards";
import { BrexExpenses } from "./BrexExpenses";
import { BrexLimits } from "./BrexLimits";
import { BrexOverview } from "./BrexOverview";
import { BrexPeople } from "./BrexPeople";
import { BrexErrorNotice, BrexTokenReplaced } from "./BrexSection";
import { BrexSpending } from "./BrexSpending";
import { BrexTravel } from "./BrexTravel";

const SECTIONS = [
  { key: "overview", path: "/app/brex" },
  { key: "cards", path: "/app/brex/cards" },
  { key: "spending", path: "/app/brex/spending" },
  { key: "limits", path: "/app/brex/limits" },
  { key: "people", path: "/app/brex/people" },
  { key: "expenses", path: "/app/brex/expenses" },
  { key: "accounts", path: "/app/brex/accounts" },
  { key: "travel", path: "/app/brex/travel" },
  { key: "activity", path: "/app/brex/activity" },
] as const;

type SectionKey = (typeof SECTIONS)[number]["key"];

function sectionLabel(key: SectionKey): string {
  switch (key) {
    case "overview":
      return t`Overview`;
    case "cards":
      return t`Cards`;
    case "spending":
      return t`Spending`;
    case "limits":
      return t`Limits`;
    case "people":
      return t`People`;
    case "expenses":
      return t`Expenses`;
    case "accounts":
      return t`Accounts`;
    case "travel":
      return t`Travel`;
    case "activity":
      return t`Activity`;
  }
}

function sectionFromPath(pathname: string): SectionKey {
  const key = pathname.split("/").filter(Boolean)[2];
  return SECTIONS.some((section) => section.key === key) ? (key as SectionKey) : "overview";
}

export function BrexPage({ spaceName }: { spaceName?: string }) {
  const location = useLocation();
  const navigate = useNavigate();
  const section = sectionFromPath(location.pathname);
  const [connectOpen, setConnectOpen] = useState(false);
  const overview = useFinanceQuery(() => rpc.brexCards.overview(), []);
  // Once the overview has answered, the tabs stay up through errors and Try again.
  const answered = useRef(false);
  if (overview.data || overview.error) answered.current = true;

  if (overview.notFound) {
    return (
      <div className="@container rk-scroll flex-1 overflow-y-auto px-4 pb-6 pt-2 md:px-7">
        <PageHeader title={<Trans>Brex</Trans>} spaceName={spaceName} />
        <PageEmptyState
          icon={<AppLogo name="Brex" size="xl" />}
          title={<Trans>Brex isn't connected.</Trans>}
          description={<Trans>Connect to see cards, spending and limits.</Trans>}
        >
          <Button onClick={() => setConnectOpen(true)}>
            <Trans>Connect Brex cards</Trans>
          </Button>
        </PageEmptyState>
        {connectOpen ? (
          <BrexCardsConnectDialog
            onClose={() => setConnectOpen(false)}
            onConnected={overview.reload}
          />
        ) : null}
      </div>
    );
  }

  const current = SECTIONS.find((item) => item.key === section) ?? SECTIONS[0];
  return (
    <BrexTokenReplaced.Provider value={overview.retry}>
      <div className="@container rk-scroll flex-1 overflow-y-auto px-4 pb-6 pt-2 md:px-7">
        <PageHeader title={<Trans>Brex</Trans>} spaceName={spaceName} />
        {!answered.current ? (
          <div className="flex flex-col gap-3" aria-busy="true">
            <span className="text-xs text-muted-foreground">
              <Trans>Loading…</Trans>
            </span>
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-40 w-full" />
            <StillLoading onRetry={overview.retry} />
          </div>
        ) : (
          <>
            <Tabs
              value={current.key}
              onValueChange={(next) => {
                const target = SECTIONS.find((item) => item.key === next);
                if (target) navigate(target.path);
              }}
            >
              <TabsList>
                {SECTIONS.map((item) => (
                  <TabsTrigger key={item.key} value={item.key}>
                    {sectionLabel(item.key)}
                  </TabsTrigger>
                ))}
              </TabsList>
            </Tabs>
            <div className="mt-4">
              {section === "overview" ? (
                overview.error ? (
                  <BrexErrorNotice query={overview} />
                ) : overview.data ? (
                  <BrexOverview data={overview.data} />
                ) : (
                  <Skeleton className="h-40 w-full" />
                )
              ) : section === "cards" ? (
                <BrexCards />
              ) : section === "spending" ? (
                <BrexSpending />
              ) : section === "limits" ? (
                <BrexLimits />
              ) : section === "people" ? (
                <BrexPeople />
              ) : section === "expenses" ? (
                <BrexExpenses />
              ) : section === "accounts" ? (
                <BrexAccounts />
              ) : section === "travel" ? (
                <BrexTravel />
              ) : section === "activity" ? (
                <BrexActivity />
              ) : (
                <PageEmptyState
                  icon={<AppLogo name="Brex" size="lg" />}
                  title={sectionLabel(current.key)}
                  description={<Trans>This section isn't available yet.</Trans>}
                />
              )}
            </div>
          </>
        )}
      </div>
    </BrexTokenReplaced.Provider>
  );
}
