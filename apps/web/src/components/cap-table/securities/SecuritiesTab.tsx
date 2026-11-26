import { t } from "@lingui/core/macro";
import type { EquityCertificate, EquityConvertible } from "@rakazo/contracts";
import { Tabs, TabsList, TabsTrigger } from "@rakazo/ui-web";
import { useState } from "react";
import { useMatch, useNavigate, useSearchParams } from "react-router-dom";
import { AppSafes } from "./AppSafes";
import type { BulkCertificateAction } from "./BulkCertificateDialog";
import { BulkCertificateDialog } from "./BulkCertificateDialog";
import type { CertificateTransaction } from "./CertificateTransactionDialog";
import { CertificateTransactionDialog } from "./CertificateTransactionDialog";
import { ConvertibleActionDialog } from "./ConvertibleActionDialog";
import { ConvertibleForm } from "./ConvertibleForm";
import { ConvertiblesLedger } from "./ConvertiblesLedger";
import { DraftSets } from "./DraftSets";
import { SafeFunding } from "./SafeFunding";
import { SecurityRecord } from "./SecurityRecord";
import { SharesLedger } from "./SharesLedger";

/** The Securities tab: the shares ledger and the SAFEs and convertibles ledger, one sub-tab each. */
export function SecuritiesTab() {
  const convertibles = useMatch("/app/cap-table/securities/convertibles");
  const drafts = useMatch("/app/cap-table/securities/drafts");
  const navigate = useNavigate();
  const [transaction, setTransaction] = useState<{
    action: CertificateTransaction;
    certificate: EquityCertificate;
  } | null>(null);
  const [convertibleAction, setConvertibleAction] = useState<{
    action: "cancel" | "priced-round";
    rows: EquityConvertible[];
  } | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [bulk, setBulk] = useState<{
    action: BulkCertificateAction;
    certificates: EquityCertificate[];
  } | null>(null);
  const [editing, setEditing] = useState<{ convertible: EquityConvertible | null } | null>(null);
  // Links from other tabs (a holder's holdings) open one record: ?certificate=<id> or ?convertible=<id>.
  const [params] = useSearchParams();
  const [open, setOpen] = useState<{ kind: "certificate" | "convertible"; id: string } | null>(
    () => {
      const certificate = params.get("certificate");
      if (certificate) return { kind: "certificate", id: certificate };
      const convertible = params.get("convertible");
      return convertible ? { kind: "convertible", id: convertible } : null;
    },
  );
  const sub = convertibles ? "convertibles" : drafts ? "drafts" : "shares";

  return (
    <div className="flex flex-col gap-4">
      <Tabs
        value={sub}
        onValueChange={(next) =>
          navigate(
            next === "shares" ? "/app/cap-table/securities" : `/app/cap-table/securities/${next}`,
          )
        }
      >
        <TabsList aria-label={t`Security types`}>
          <TabsTrigger value="shares">{t`Shares`}</TabsTrigger>
          <TabsTrigger value="convertibles">{t`SAFEs and convertibles`}</TabsTrigger>
          <TabsTrigger value="drafts">{t`Draft sets`}</TabsTrigger>
        </TabsList>
      </Tabs>
      {sub === "shares" ? (
        <SharesLedger
          onBulk={(action, certificates) => setBulk({ action, certificates })}
          reloadKey={reloadKey}
          onOpen={(id) => setOpen({ kind: "certificate", id })}
          onAction={(action, certificate) => {
            if (action === "view") setOpen({ kind: "certificate", id: certificate.id });
            else setTransaction({ action, certificate });
          }}
        />
      ) : sub === "drafts" ? (
        <div className="flex flex-col gap-6">
          <section className="flex flex-col gap-2">
            <h2 className="text-sm font-medium">{t`Shares`}</h2>
            <DraftSets kind="certificate" onIssued={() => setReloadKey((key) => key + 1)} />
          </section>
          <section className="flex flex-col gap-2">
            <h2 className="text-sm font-medium">{t`SAFEs and convertibles`}</h2>
            <DraftSets kind="convertible" onIssued={() => setReloadKey((key) => key + 1)} />
          </section>
        </div>
      ) : (
        <div className="flex flex-col gap-6">
          <SafeFunding reloadKey={reloadKey} />
          <ConvertiblesLedger
            reloadKey={reloadKey}
            onOpen={(id) => setOpen({ kind: "convertible", id })}
            onAction={(action, rows) => {
              if (action === "view") setOpen({ kind: "convertible", id: rows[0]!.id });
              else if (action === "edit") setEditing({ convertible: rows[0] ?? null });
              else setConvertibleAction({ action, rows });
            }}
          />
          <AppSafes reloadKey={reloadKey} onAdded={() => setReloadKey((key) => key + 1)} />
        </div>
      )}
      {open ? (
        <SecurityRecord
          kind={open.kind}
          id={open.id}
          reloadKey={reloadKey}
          onOpenChange={(next) => {
            if (!next) setOpen(null);
          }}
          onCertificateAction={(action, certificate) => setTransaction({ action, certificate })}
        />
      ) : null}
      {bulk ? (
        <BulkCertificateDialog
          action={bulk.action}
          certificates={bulk.certificates}
          onOpenChange={(next) => {
            if (!next) setBulk(null);
          }}
          onDone={() => {
            setBulk(null);
            setReloadKey((key) => key + 1);
          }}
        />
      ) : null}
      {editing ? (
        <ConvertibleForm
          convertible={editing.convertible}
          onOpenChange={(next) => {
            if (!next) setEditing(null);
          }}
          onSaved={() => {
            setEditing(null);
            setReloadKey((key) => key + 1);
          }}
        />
      ) : null}
      {convertibleAction ? (
        <ConvertibleActionDialog
          action={convertibleAction.action}
          convertibles={convertibleAction.rows}
          onOpenChange={(open) => {
            if (!open) setConvertibleAction(null);
          }}
          onDone={() => {
            setConvertibleAction(null);
            setReloadKey((key) => key + 1);
          }}
        />
      ) : null}
      {transaction ? (
        <CertificateTransactionDialog
          action={transaction.action}
          certificate={transaction.certificate}
          onOpenChange={(open) => {
            if (!open) setTransaction(null);
          }}
          onDone={() => {
            setTransaction(null);
            setReloadKey((key) => key + 1);
          }}
        />
      ) : null}
    </div>
  );
}
