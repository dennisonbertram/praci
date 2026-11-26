import { t } from "@lingui/core/macro";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@rakazo/ui-web";
import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { rpc } from "../../../lib/rpc";
import { AccessGroupLevels } from "./AccessGroupLevels";
import { AccessIndividualLevels } from "./AccessIndividualLevels";
import { AccessRequests } from "./AccessRequests";
import { DocumentLinks } from "./DocumentLinks";
import { InvestorRelations } from "./InvestorRelations";

const VIEWS = ["investors", "groups", "individuals", "requests", "documents"] as const;
type View = (typeof VIEWS)[number];

/** The access tab: group defaults and individual overrides, open requests; the open tab is kept in the URL. */
export function AccessPage() {
  const [params, setParams] = useSearchParams();
  const asked = params.get("view");
  const view: View = VIEWS.includes(asked as View) ? (asked as View) : "investors";
  // Waiting requests, counted again on each switch so an answered one drops off.
  const [waiting, setWaiting] = useState(0);
  useEffect(() => {
    let live = true;
    rpc.equity.accessHolders
      .list({ requested: true, page: 1, pageSize: 1 })
      .then((page) => {
        if (live) setWaiting(page.total);
      })
      .catch(() => undefined);
    return () => {
      live = false;
    };
  }, [view]);
  return (
    <Tabs
      value={view}
      onValueChange={(next) =>
        setParams(
          (current) => {
            const updated = new URLSearchParams(current);
            updated.set("view", String(next));
            return updated;
          },
          { replace: true },
        )
      }
    >
      <TabsList>
        <TabsTrigger value="investors">{t`Investors`}</TabsTrigger>
        <TabsTrigger value="groups">{t`Group levels`}</TabsTrigger>
        <TabsTrigger value="individuals">{t`Individual levels`}</TabsTrigger>
        <TabsTrigger value="requests">
          {t`Open requests`}
          {waiting > 0 ? (
            <span className="tabular-nums text-muted-foreground">{waiting}</span>
          ) : null}
        </TabsTrigger>
        <TabsTrigger value="documents">{t`Documents`}</TabsTrigger>
      </TabsList>
      <TabsContent value="investors" className="pt-3">
        <InvestorRelations />
      </TabsContent>
      <TabsContent value="groups" className="pt-3">
        <AccessGroupLevels />
      </TabsContent>
      <TabsContent value="individuals" className="pt-3">
        <AccessIndividualLevels />
      </TabsContent>
      <TabsContent value="requests" className="pt-3">
        <AccessRequests />
      </TabsContent>
      <TabsContent value="documents" className="pt-3">
        <DocumentLinks />
      </TabsContent>
    </Tabs>
  );
}
