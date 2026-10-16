import { t } from "@lingui/core/macro";
import { Trans } from "@lingui/react/macro";
import type { FinanceTransactionOutput } from "@rakazo/contracts";
import { categorySlug } from "@rakazo/core";
import { Button } from "@rakazo/ui-web";
import { ExternalLink, FileText } from "lucide-react";
import { useState } from "react";
import { Link, useLocation } from "react-router-dom";
import {
  type Crumb,
  DetailPage,
  Kv,
  KvRow,
  previewFrom,
  Section,
  useFinanceQuery,
  ValueLink,
} from "../../components/finance/ui";
import {
  accountLabel,
  fullDay,
  monthLabel,
  transactionAmount,
  txnDay,
} from "../../lib/finance-format";
import { financePath } from "../../lib/finance-route";
import { rpc } from "../../lib/rpc";

export const ReceiptIcon = () => (
  <FileText aria-label={t`Receipt`} role="img" className="inline size-4 text-foreground" />
);

/** Vendor links expire and come from a third party: only plain https links are shown. */
function httpsUrl(value: string | null): string | null {
  if (!value) return null;
  try {
    return new URL(value).protocol === "https:" ? value : null;
  } catch {
    return null;
  }
}

const isSpend = (txn: FinanceTransactionOutput["transaction"]) =>
  txn.classification === "spend" && txn.amountCents < 0;

/** Where the transaction sits in the app, so Back returns to the page the user is most likely to have come from. */
export function transactionCrumbs(data: FinanceTransactionOutput): Crumb[] {
  const { transaction: txn, account, vendorName, vendorIsSubscription } = data;
  const root = { label: t`Finance`, to: financePath.dashboard() };
  const here = { label: txn.counterparty, to: financePath.transaction(txn.id) };
  if (!isSpend(txn)) {
    return [
      root,
      { label: t`Accounts`, to: financePath.accounts() },
      ...(account ? [{ label: account.name, to: financePath.account(account.id) }] : []),
      here,
    ];
  }
  if (vendorIsSubscription) {
    return [
      root,
      { label: t`Subscriptions`, to: financePath.dashboard() },
      { label: vendorName, to: financePath.vendor(txn.vendorKey) },
      here,
    ];
  }
  const month = txnDay(txn).slice(0, 7);
  return [
    root,
    { label: t`Burn`, to: financePath.burn() },
    { label: monthLabel(month), to: financePath.month(month) },
    here,
  ];
}

function ReceiptThumb({ id }: { id: string }) {
  const q = useFinanceQuery(() => rpc.finance.receiptUrl({ transactionId: id }), [id]);
  const url = q.data ? httpsUrl(q.data.url) : null;
  const image = Boolean(url && q.data?.mimeType?.startsWith("image/"));
  return (
    <Link
      to={financePath.receipt(id)}
      aria-label={t`Open receipt`}
      className="inline-flex size-28 items-center justify-center overflow-hidden rounded-md border border-border hover:border-foreground"
    >
      {image && url ? (
        <img src={url} alt="" referrerPolicy="no-referrer" className="size-full object-cover" />
      ) : (
        <FileText aria-hidden="true" className="size-6" />
      )}
    </Link>
  );
}

/** Mercury listings never say whether a row has an attachment, so the vendor is asked on demand. */
function CheckReceipt({ id }: { id: string }) {
  const [state, setState] = useState<"idle" | "checking" | "found" | "none">("idle");
  if (state === "found") return <ReceiptThumb id={id} />;
  if (state === "none") {
    return (
      <span className="text-muted-foreground">
        <Trans>No receipt</Trans>
      </span>
    );
  }
  return (
    <Button
      variant="outline"
      size="sm"
      disabled={state === "checking"}
      onClick={() => {
        setState("checking");
        rpc.finance
          .receiptUrl({ transactionId: id })
          .then(() => setState("found"))
          .catch((cause: { code?: string }) =>
            setState(cause?.code === "NOT_FOUND" ? "none" : "idle"),
          );
      }}
    >
      <Trans>Check for receipt</Trans>
    </Button>
  );
}

export function FinanceTransactionPage({ id }: { id: string }) {
  const q = useFinanceQuery(() => rpc.finance.transaction({ id }), [id]);
  const data = q.data;
  // The row clicked in a list is shown at once; the rest (account, receipt) follows when loaded.
  const preview = previewFrom(useLocation().state, id);
  const txn = data?.transaction ?? preview;
  const spend = txn ? isSpend(txn) : false;
  const external = txn ? httpsUrl(txn.dashboardUrl) : null;
  const providerName = txn?.provider === "brex" ? "Brex" : "Mercury";
  const source = data?.account
    ? accountLabel(data.account.name, data.account.lastFour)
    : txn?.cardLastFour
      ? `${providerName} ••${txn.cardLastFour}`
      : providerName;
  const status =
    txn?.status === "pending" ? t`Pending` : txn?.status === "posted" ? t`Posted` : t`Other`;
  const day = txn ? txnDay(txn) : "";
  const posted = txn?.postedAt.slice(0, 10) ?? "";
  return (
    <DetailPage
      crumbs={
        data
          ? transactionCrumbs(data)
          : [
              { label: t`Finance`, to: financePath.dashboard() },
              ...(txn ? [{ label: txn.counterparty }] : []),
            ]
      }
      title={txn?.counterparty}
      loading={!txn}
      error={q.error}
      notFound={q.notFound}
      onRetry={q.retry}
    >
      {txn ? (
        <div className="grid gap-3 @3xl:grid-cols-2">
          <Section>
            <div className="mb-2 text-[26px] font-semibold tabular-nums">
              {transactionAmount(txn.amountCents)}
            </div>
            <Kv>
              <KvRow label={t`Merchant`}>
                {spend ? (
                  <ValueLink to={financePath.vendor(txn.vendorKey)}>{txn.counterparty}</ValueLink>
                ) : (
                  txn.counterparty
                )}
              </KvRow>
              <KvRow label={t`Date`}>{fullDay(day)}</KvRow>
              {posted !== day ? <KvRow label={t`Posted`}>{fullDay(posted)}</KvRow> : null}
              <KvRow label={t`Status`}>{status}</KvRow>
              <KvRow label={t`Source`}>{source}</KvRow>
              {txn.cardholder ? (
                <KvRow label={txn.cardLastFour ? t`Cardholder` : t`Initiated by`}>
                  {txn.cardholder}
                </KvRow>
              ) : null}
              <KvRow label={t`Category`}>
                {spend && txn.category ? (
                  <ValueLink to={financePath.category(categorySlug(txn.category))}>
                    {txn.category}
                  </ValueLink>
                ) : (
                  (txn.category ?? t`Uncategorized`)
                )}
              </KvRow>
              {txn.memo ? <KvRow label={t`Memo`}>{txn.memo}</KvRow> : null}
            </Kv>
            {external ? (
              <div className="mt-3.5">
                <Button
                  variant="outline"
                  render={<a href={external} target="_blank" rel="noopener noreferrer" />}
                >
                  {txn.provider === "brex" ? (
                    <Trans>Open in Brex</Trans>
                  ) : (
                    <Trans>Open in Mercury</Trans>
                  )}
                  <ExternalLink aria-hidden="true" />
                </Button>
              </div>
            ) : null}
          </Section>
          {spend ? (
            <Section title={<Trans>Receipt</Trans>}>
              {!data ? (
                <span className="text-muted-foreground">
                  <Trans>Loading…</Trans>
                </span>
              ) : txn.hasReceipt ? (
                <div>
                  <ReceiptThumb id={txn.id} />
                </div>
              ) : txn.provider === "mercury" ? (
                <CheckReceipt id={txn.id} />
              ) : (
                <span className="text-muted-foreground">
                  <Trans>No receipt</Trans>
                </span>
              )}
            </Section>
          ) : null}
        </div>
      ) : null}
    </DetailPage>
  );
}

export function FinanceReceiptPage({ id }: { id: string }) {
  const txn = useFinanceQuery(() => rpc.finance.transaction({ id }), [id]);
  const receipt = useFinanceQuery(() => rpc.finance.receiptUrl({ transactionId: id }), [id]);
  const url = receipt.data ? httpsUrl(receipt.data.url) : null;
  const mime = receipt.data?.mimeType ?? "";
  const crumbs = txn.data
    ? transactionCrumbs(txn.data)
    : [{ label: t`Finance`, to: financePath.dashboard() }];
  return (
    <DetailPage
      crumbs={[...crumbs, { label: t`Receipt` }]}
      title={<Trans>Receipt</Trans>}
      loading={!txn.data || (!receipt.data && !receipt.notFound)}
      error={txn.error || (receipt.notFound ? "" : receipt.error)}
      notFound={txn.notFound}
      onRetry={() => {
        txn.retry();
        receipt.retry();
      }}
    >
      {url ? (
        <Section>
          <div className="flex flex-col items-center gap-3">
            {mime.startsWith("image/") ? (
              <img
                src={url}
                alt={t`Receipt`}
                referrerPolicy="no-referrer"
                className="max-h-[75vh] max-w-full rounded-md"
              />
            ) : mime === "application/pdf" ? (
              <iframe title={t`Receipt`} src={url} className="h-[75vh] w-full border-0" />
            ) : null}
            <Button
              variant="outline"
              render={<a href={url} target="_blank" rel="noopener noreferrer" />}
            >
              <Trans>Open receipt</Trans>
              <ExternalLink aria-hidden="true" />
            </Button>
          </div>
        </Section>
      ) : (
        <Section>
          <span className="text-muted-foreground">
            <Trans>No receipt</Trans>
          </span>
        </Section>
      )}
    </DetailPage>
  );
}
