import { t } from "@lingui/core/macro";
import type {
  EquityCertificate,
  EquityConvertible,
  EquityRelationship,
  EquityStakeholder,
  EquityTransaction,
} from "@rakazo/contracts";
import {
  EQUITY_CERTIFICATE_STATUS_LABELS,
  EQUITY_OUTSTANDING_CERTIFICATE_STATUSES,
  EQUITY_REASON_LABELS,
  EQUITY_RELATIONSHIP_LABELS,
} from "@rakazo/contracts";
import {
  Button,
  Sheet,
  SheetBody,
  SheetContent,
  SheetFooter,
  SheetTitle,
  Skeleton,
  Textarea,
} from "@rakazo/ui-web";
import { useEffect, useState } from "react";
import { rpc } from "../../../lib/rpc";
import { errorText } from "../../../lib/user-error";
import type { CertificateTransaction } from "./CertificateTransactionDialog";
import { convertibleStatusLabel } from "./ConvertiblesLedger";
import { formatCents, formatDay, formatPercent, formatPrice, formatShares } from "./format";

type Field = [label: string, value: string | null | undefined];

const shown = (value: string | null | undefined) => (value == null || value === "" ? "—" : value);
const percent = (value: string | null) => (value == null ? null : formatPercent(value));
const yes = (value: boolean) => (value ? t`Yes` : t`No`);

function Section({ title, fields }: { title: string; fields: Field[] }) {
  return (
    <section className="flex flex-col gap-2">
      <h3 className="text-sm font-medium">{title}</h3>
      <dl className="grid grid-cols-[minmax(0,12rem)_1fr] gap-x-4 gap-y-1 text-sm">
        {fields.map(([label, value]) => (
          <div key={label} className="contents">
            <dt className="text-muted-foreground">{label}</dt>
            <dd className="tabular-nums">{shown(value)}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

const kindLabel = (kind: string): string =>
  (
    ({
      issue: t`Issued`,
      modify: t`Modified`,
      transfer: t`Transferred`,
      repurchase: t`Repurchased`,
      cancel: t`Canceled`,
      convert: t`Converted`,
      import: t`Imported`,
    }) as Record<string, string>
  )[kind] ?? kind;

function History({ rows }: { rows: EquityTransaction[] }) {
  if (rows.length === 0) return null;
  return (
    <section className="flex flex-col gap-2">
      <h3 className="text-sm font-medium">{t`History`}</h3>
      <ul className="flex flex-col gap-1 text-sm">
        {rows.map((row) => (
          <li key={row.id} className="flex flex-wrap gap-x-3">
            <span className="text-muted-foreground tabular-nums">
              {formatDay(row.effectiveDate)}
            </span>
            <span>{kindLabel(row.kind)}</span>
            {row.quantity ? (
              <span className="tabular-nums">{formatShares(row.quantity)}</span>
            ) : null}
            {row.reason ? <span>{EQUITY_REASON_LABELS[row.reason] ?? row.reason}</span> : null}
            {row.note ? <span className="text-muted-foreground">{row.note}</span> : null}
          </li>
        ))}
      </ul>
    </section>
  );
}

const relationship = (value: string | null | undefined) =>
  value ? (EQUITY_RELATIONSHIP_LABELS[value as EquityRelationship] ?? value) : null;

function certificateSections(
  row: EquityCertificate,
  holder: EquityStakeholder | null,
): { title: string; fields: Field[] }[] {
  // The details recorded at issue; without them, the holder as the Stakeholders tab has them now.
  const person =
    row.personnel ??
    (holder && {
      name: holder.name,
      email: holder.contactEmail ?? holder.portfolioEmail ?? null,
      relationship: holder.relationship ?? null,
      taxId: holder.taxId ?? null,
      employeeId: holder.employeeId ?? null,
    });
  return [
    {
      title: t`Details`,
      fields: [
        [t`Share class`, row.shareClassName],
        [t`Shares`, formatShares(row.quantity)],
        [t`Price per share`, formatPrice(row.pricePerShare)],
        [t`Price paid per share`, formatPrice(row.pricePaidPerShare)],
        [t`Cash paid`, formatCents(row.cashPaidCents)],
        [t`Debt canceled`, formatCents(row.debtCanceledCents)],
        [t`IP transferred`, formatCents(row.ipTransferredCents)],
        [t`Other consideration`, formatCents(row.otherConsiderationCents)],
        [t`Transaction value`, formatCents(row.transactionValueCents)],
        [t`Issue date`, formatDay(row.issueDate)],
        [t`Board approval`, formatDay(row.boardApprovedOn)],
        [t`Issued by`, row.issuedBy],
      ],
    },
    {
      title: t`Personnel`,
      fields: [
        [t`Name`, person?.name ?? row.stakeholderName],
        [t`Email`, person?.email],
        [t`Relationship`, relationship(person?.relationship)],
        [t`Tax ID`, person?.taxId ? `•••• ${person.taxId.slice(-4)}` : null],
        [t`Employee ID`, person?.employeeId],
      ],
    },
    {
      title: t`Compliance`,
      fields: [
        [t`Federal exemption`, row.federalExemption],
        [t`State exemption`, row.stateExemption],
        [t`State of residency`, row.stateOfResidency],
        [t`Rule 144 date`, formatDay(row.rule144Date)],
      ],
    },
  ];
}

function convertibleSections(row: EquityConvertible): { title: string; fields: Field[] }[] {
  const note = row.kind === "note";
  return [
    {
      title: t`Terms`,
      fields: [
        [t`Principal`, formatCents(row.principalCents)],
        [t`Valuation cap`, formatCents(row.valuationCapCents)],
        [
          t`Cap type`,
          row.valuationCapType === "post_money"
            ? t`Post-money`
            : row.valuationCapType
              ? t`Pre-money`
              : null,
        ],
        [t`Discount`, percent(row.discountPercent)],
        ...(note
          ? ([
              [t`Interest rate`, percent(row.interestRate)],
              [t`Interest`, row.interestType === "compound" ? t`Compound` : t`Simple`],
              [t`Interest start`, formatDay(row.interestStartDate)],
              [t`Maturity date`, formatDay(row.maturityDate)],
              [t`Interest accrued`, formatCents(row.interestAccruedCents)],
              [t`Total`, formatCents(row.totalCents)],
            ] as Field[])
          : []),
        [t`MFN`, yes(row.mfn)],
        [t`Pro rata`, yes(row.proRata)],
        [t`Issue date`, formatDay(row.issueDate)],
      ],
    },
    {
      title: t`Compliance`,
      fields: [
        [t`Board approval`, formatDay(row.boardApprovedOn)],
        [t`Federal exemption`, row.federalExemption],
        [t`State exemption`, row.stateExemption],
        [t`State of residency`, row.stateOfResidency],
      ],
    },
    ...(row.status === "converted" || row.status === "canceled" || row.status === "repaid"
      ? [
          {
            title:
              row.status === "converted"
                ? t`Conversion`
                : row.status === "canceled"
                  ? t`Cancellation`
                  : t`Repayment`,
            fields: [
              ...(row.status === "converted" && row.convertedToLabel
                ? [[t`Converted to`, row.convertedToLabel]]
                : []),
              ...(row.closedOn ? [[t`Closed on`, formatDay(row.closedOn)]] : []),
              ...(row.status === "canceled" && row.cancellationReason
                ? [[t`Reason`, row.cancellationReason]]
                : []),
            ] as Field[],
          },
        ]
      : []),
  ];
}

/** One security's record in a side sheet: its terms, compliance, legend and history. */
export function SecurityRecord({
  kind,
  id,
  reloadKey = 0,
  onOpenChange,
  onCertificateAction,
}: {
  kind: "certificate" | "convertible";
  id: string;
  reloadKey?: number;
  onOpenChange: (open: boolean) => void;
  onCertificateAction?: (action: CertificateTransaction, certificate: EquityCertificate) => void;
}) {
  const [record, setRecord] = useState<EquityCertificate | EquityConvertible | null>(null);
  const [history, setHistory] = useState<EquityTransaction[]>([]);
  const [holder, setHolder] = useState<EquityStakeholder | null>(null);
  const [legend, setLegend] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let live = true;
    setError("");
    const load =
      kind === "certificate"
        ? rpc.equity.certificates.get({ id })
        : rpc.equity.convertibles.get({ id });
    Promise.all([
      load,
      rpc.equity.transactions.list({
        pageSize: 100,
        sort: { field: "createdAt", dir: "desc" },
        ...(kind === "certificate" ? { certificateId: id } : { convertibleId: id }),
      }),
    ])
      .then(([loaded, transactions]) => {
        if (!live) return;
        setRecord(loaded);
        setHistory(transactions.items);
        if ("personnel" in loaded && !loaded.personnel)
          rpc.equity.stakeholders
            .get({ id: loaded.stakeholderId })
            .then((found) => live && setHolder(found))
            .catch(() => {});
        setLegend("legend" in loaded ? (loaded.legend ?? "") : "");
      })
      .catch((cause: unknown) => {
        if (live) setError(errorText(cause));
      });
    return () => {
      live = false;
    };
  }, [kind, id, reloadKey]);

  const certificate = record && kind === "certificate" ? (record as EquityCertificate) : null;
  const convertible = record && kind === "convertible" ? (record as EquityConvertible) : null;
  const outstanding = certificate
    ? EQUITY_OUTSTANDING_CERTIFICATE_STATUSES.includes(certificate.status)
    : false;

  const saveLegend = async () => {
    if (!certificate) return;
    setSaving(true);
    try {
      setRecord(
        await rpc.equity.certificates.update({
          id: certificate.id,
          legend,
          reason: "clerical_error",
        }),
      );
    } catch (cause) {
      setError(errorText(cause));
    } finally {
      setSaving(false);
    }
  };

  const status = certificate
    ? EQUITY_CERTIFICATE_STATUS_LABELS[certificate.status]
    : convertible
      ? convertibleStatusLabel(convertible.status)
      : "";

  return (
    <Sheet open onOpenChange={onOpenChange}>
      <SheetContent className="sm:mx-auto sm:max-w-2xl">
        <SheetTitle>
          {record ? `${record.label} · ${record.stakeholderName}` : t`Security`}
        </SheetTitle>
        <SheetBody className="flex flex-col gap-5">
          {error ? (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          ) : record == null ? (
            <Skeleton className="h-64 w-full" />
          ) : (
            <>
              <p className="text-sm text-muted-foreground">
                {convertible ? `${convertible.kind === "safe" ? t`SAFE` : t`Note`} · ` : ""}
                {status}
              </p>
              {(certificate
                ? certificateSections(certificate, holder)
                : convertibleSections(convertible!)
              ).map((section) => (
                <Section key={section.title} title={section.title} fields={section.fields} />
              ))}
              {certificate ? (
                <section className="flex flex-col gap-2">
                  <h3 className="text-sm font-medium">
                    <label htmlFor="certificate-legend">{t`Legend`}</label>
                  </h3>
                  <Textarea
                    id="certificate-legend"
                    rows={4}
                    value={legend}
                    onChange={(event) => setLegend(event.target.value)}
                  />
                  {legend !== (certificate.legend ?? "") ? (
                    <Button
                      size="sm"
                      className="self-start"
                      disabled={saving}
                      onClick={() => void saveLegend()}
                    >
                      {t`Save legend`}
                    </Button>
                  ) : null}
                </section>
              ) : null}
              <History rows={history} />
            </>
          )}
        </SheetBody>
        {certificate && onCertificateAction && outstanding ? (
          <SheetFooter className="flex flex-wrap gap-2">
            {(
              [
                ["transfer", t`Transfer`],
                ["modify", t`Modify`],
                ["repurchase", t`Repurchase`],
                ["convert", t`Convert`],
                ["cancel", t`Cancel`],
              ] as const
            ).map(([action, label]) => (
              <Button
                key={action}
                size="sm"
                variant={action === "cancel" ? "destructive" : "outline"}
                onClick={() => onCertificateAction(action, certificate)}
              >
                {label}
              </Button>
            ))}
          </SheetFooter>
        ) : null}
      </SheetContent>
    </Sheet>
  );
}
