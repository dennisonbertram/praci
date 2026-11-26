import { i18n } from "@lingui/core";
import { t } from "@lingui/core/macro";
import type {
  EquityCertificate,
  EquityConvertible,
  EquityCustomProperty,
  EquityOptionGrant,
  EquityRelationship,
  EquityStakeholderDetail,
} from "@rakazo/contracts";
import { EQUITY_RELATIONSHIP_LABELS } from "@rakazo/contracts";
import {
  Badge,
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  Skeleton,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableHeadRow,
  TableRow,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@rakazo/ui-web";
import { ArrowLeft, ChevronDown } from "lucide-react";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { listAllPages } from "../../../lib/list-all";
import { rpc } from "../../../lib/rpc";
import { errorText } from "../../../lib/user-error";
import { SectionCard } from "../../SectionCard";
import { formatDay } from "../options/format";
import { CapTableEmptyState } from "../shell/CapTableEmptyState";

const DASH = "—";
const shares = (value: string) => new Intl.NumberFormat(i18n.locale || "en").format(BigInt(value));
const dollars = (cents: string) =>
  `$${new Intl.NumberFormat(i18n.locale || "en").format(BigInt(cents) / 100n)}`;

export const relationshipLabel = (value: string | null) =>
  value ? (EQUITY_RELATIONSHIP_LABELS[value as EquityRelationship] ?? value) : DASH;

/** Why Terminate is unavailable, or null when it is available. */
export function terminateBlocked(stakeholder: {
  relationship: string | null;
  terminatedOn: string | null;
  mergedIntoId: string | null;
}): string | null {
  if (stakeholder.mergedIntoId) return t`Merged into another stakeholder`;
  if (stakeholder.terminatedOn) return t`Terminated ${stakeholder.terminatedOn}`;
  if (stakeholder.relationship === "investor") return t`Investors have no employment to end`;
  if (stakeholder.relationship?.startsWith("ex_")) return t`Already a former relationship`;
  if (!stakeholder.relationship) return t`No relationship entered`;
  return null;
}

/** The Terminate menu item's content: the action, and the reason when it is unavailable. */
export function TerminateLabel({ blocked }: { blocked: string | null }) {
  return (
    <span className="flex flex-col">
      {t`Terminate stakeholder`}
      {blocked && <span className="text-xs text-muted-foreground">{blocked}</span>}
    </span>
  );
}

/** Terminate applies to people with a current working relationship. */
export function canTerminate(stakeholder: {
  relationship: string | null;
  terminatedOn: string | null;
  mergedIntoId: string | null;
}): boolean {
  const { relationship } = stakeholder;
  return (
    relationship != null &&
    relationship !== "investor" &&
    !relationship.startsWith("ex_") &&
    stakeholder.terminatedOn == null &&
    stakeholder.mergedIntoId == null
  );
}

/** Relationship entries as periods, newest first: each ends the day before the next begins. */
export function relationshipPeriods(stakeholder: EquityStakeholderDetail) {
  const entries = stakeholder.properties
    .filter((property) => property.kind === "relationship")
    .sort((a, b) => a.effectiveDate.localeCompare(b.effectiveDate));
  return entries
    .map((entry, index) => {
      const next = entries[index + 1];
      const to = next
        ? new Date(Date.parse(`${next.effectiveDate}T00:00:00Z`) - 86_400_000)
            .toISOString()
            .slice(0, 10)
        : null;
      return { id: entry.id, value: entry.value, from: entry.effectiveDate, to };
    })
    .reverse();
}

/** Label and value pairs; empty values are left out rather than shown as dashes. */
function Fields({ rows }: { rows: [string, string | null | undefined][] }) {
  const filled = rows.filter(([, value]) => value);
  if (!filled.length) return <p className="text-sm text-muted-foreground">{DASH}</p>;
  return (
    <dl className="grid grid-cols-[minmax(8rem,auto)_1fr] gap-x-4 gap-y-2 text-sm">
      {filled.map(([label, value]) => (
        <div key={label} className="contents">
          <dt className="text-muted-foreground">{label}</dt>
          <dd className="min-w-0 break-words">{value}</dd>
        </div>
      ))}
    </dl>
  );
}

type Holdings = {
  certificates: EquityCertificate[];
  convertibles: EquityConvertible[];
  grants: EquityOptionGrant[];
};

export function HoldingsTab({ stakeholderId }: { stakeholderId: string }) {
  const [holdings, setHoldings] = useState<Holdings | null>(null);
  const [error, setError] = useState("");
  useEffect(() => {
    let live = true;
    Promise.all([
      listAllPages((page) => rpc.equity.certificates.list({ stakeholderId, page, pageSize: 500 })),
      listAllPages((page) => rpc.equity.convertibles.list({ stakeholderId, page, pageSize: 500 })),
      listAllPages((page) => rpc.equity.optionGrants.list({ stakeholderId, page, pageSize: 500 })),
    ])
      .then(([certificates, convertibles, grants]) => {
        if (live)
          setHoldings({
            certificates,
            convertibles,
            grants,
          });
      })
      .catch((cause: unknown) => live && setError(errorText(cause)));
    return () => {
      live = false;
    };
  }, [stakeholderId]);

  if (error) return <p className="text-sm text-destructive">{error}</p>;
  if (!holdings) return <Skeleton className="h-32 w-full" />;
  const { certificates, convertibles, grants } = holdings;
  if (!certificates.length && !convertibles.length && !grants.length)
    return <CapTableEmptyState message={t`No holdings`} />;
  return (
    <div className="flex flex-col gap-6">
      {certificates.length > 0 && (
        <SectionCard title={t`Certificates`}>
          <Table>
            <TableHeader>
              <TableHeadRow>
                <TableHead>{t`Security`}</TableHead>
                <TableHead>{t`Share class`}</TableHead>
                <TableHead className="text-end">{t`Quantity`}</TableHead>
                <TableHead>{t`Issued`}</TableHead>
                <TableHead>{t`Status`}</TableHead>
              </TableHeadRow>
            </TableHeader>
            <TableBody>
              {certificates.map((row) => (
                <TableRow key={row.id}>
                  <TableCell>
                    <Link
                      className="underline-offset-4 hover:underline"
                      to={`/app/cap-table/securities?certificate=${row.id}`}
                    >
                      {row.label}
                    </Link>
                  </TableCell>
                  <TableCell>{row.shareClassName}</TableCell>
                  <TableCell className="text-end tabular-nums">{shares(row.quantity)}</TableCell>
                  <TableCell>{formatDay(row.issueDate)}</TableCell>
                  <TableCell className="capitalize">{row.status}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </SectionCard>
      )}
      {convertibles.length > 0 && (
        <SectionCard title={t`Convertibles`}>
          <Table>
            <TableHeader>
              <TableHeadRow>
                <TableHead>{t`Security`}</TableHead>
                <TableHead>{t`Type`}</TableHead>
                <TableHead className="text-end">{t`Principal`}</TableHead>
                <TableHead>{t`Issued`}</TableHead>
                <TableHead>{t`Status`}</TableHead>
              </TableHeadRow>
            </TableHeader>
            <TableBody>
              {convertibles.map((row) => (
                <TableRow key={row.id}>
                  <TableCell>
                    <Link
                      className="underline-offset-4 hover:underline"
                      to={`/app/cap-table/securities?convertible=${row.id}`}
                    >
                      {row.label}
                    </Link>
                  </TableCell>
                  <TableCell>{row.kind}</TableCell>
                  <TableCell className="text-end tabular-nums">
                    {dollars(row.principalCents)}
                  </TableCell>
                  <TableCell>{formatDay(row.issueDate)}</TableCell>
                  <TableCell className="capitalize">{row.status}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </SectionCard>
      )}
      {grants.length > 0 && (
        <SectionCard title={t`Option grants`}>
          <Table>
            <TableHeader>
              <TableHeadRow>
                <TableHead>{t`Grant`}</TableHead>
                <TableHead>{t`Plan`}</TableHead>
                <TableHead className="text-end">{t`Granted`}</TableHead>
                <TableHead className="text-end">{t`Vested`}</TableHead>
                <TableHead>{t`Grant date`}</TableHead>
                <TableHead>{t`Status`}</TableHead>
              </TableHeadRow>
            </TableHeader>
            <TableBody>
              {grants.map((row) => (
                <TableRow key={row.id}>
                  <TableCell>
                    <Link
                      className="underline-offset-4 hover:underline"
                      to={`/app/cap-table/plans/grants?grant=${row.id}`}
                    >
                      {row.label}
                    </Link>
                  </TableCell>
                  <TableCell>{row.planName}</TableCell>
                  <TableCell className="text-end tabular-nums">{shares(row.quantity)}</TableCell>
                  <TableCell className="text-end tabular-nums">
                    {shares(row.vestedQuantity)}
                  </TableCell>
                  <TableCell>{formatDay(row.grantDate)}</TableCell>
                  <TableCell className="capitalize">{row.status}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </SectionCard>
      )}
    </div>
  );
}

export type StakeholderProfileProps = {
  stakeholder: EquityStakeholderDetail;
  customProperties: EquityCustomProperty[];
  onBack: () => void;
  onEdit: () => void;
  onEditProperties: () => void;
  onTerminate: () => void;
  onDownloadContact: () => void;
  /** Records merged into this one, and the record this one was merged into. */
  merges?: { from: { id: string; name: string }[]; into: { id: string; name: string } | null };
  onOpen?: (id: string) => void;
};

/** One stakeholder: header with actions, then Overview, Holdings and History. */
export function StakeholderProfile({
  stakeholder,
  customProperties,
  onBack,
  onEdit,
  onEditProperties,
  onTerminate,
  onDownloadContact,
  merges,
  onOpen,
}: StakeholderProfileProps) {
  const address = stakeholder.addresses[0];
  const periods = relationshipPeriods(stakeholder);
  const individual = stakeholder.type === "individual";
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <Button variant="ghost" size="sm" onClick={onBack}>
          <ArrowLeft aria-hidden="true" />
          {t`Stakeholders`}
        </Button>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <h2 className="text-lg font-semibold">{stakeholder.name}</h2>
        {stakeholder.relationship && (
          <span className="text-sm text-muted-foreground">
            {relationshipLabel(stakeholder.relationship)}
          </span>
        )}
        {stakeholder.terminatedOn && (
          <Badge variant="secondary">{t`Terminated ${stakeholder.terminatedOn}`}</Badge>
        )}
        {stakeholder.mergedIntoId && !merges?.into && (
          <Badge variant="secondary">{t`Merged`}</Badge>
        )}
        {merges?.into && (
          <button
            type="button"
            className="text-sm underline-offset-4 hover:underline"
            onClick={() => onOpen?.(merges.into!.id)}
          >{t`Merged into ${merges.into.name}`}</button>
        )}
        {merges?.from.map((row) => (
          <button
            key={row.id}
            type="button"
            className="text-sm text-muted-foreground underline-offset-4 hover:underline"
            onClick={() => onOpen?.(row.id)}
          >{t`Merged from ${row.name}`}</button>
        ))}
        <div className="ms-auto flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={onDownloadContact}
            aria-label={t`Download contact information`}
          >
            {t`Download`}
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger render={<Button size="sm" />}>
              {t`Actions`}
              <ChevronDown aria-hidden="true" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="min-w-60">
              <DropdownMenuItem onClick={onEdit}>{t`Edit stakeholder`}</DropdownMenuItem>
              <DropdownMenuItem onClick={onEditProperties}>
                {t`Edit stakeholder properties`}
              </DropdownMenuItem>
              <DropdownMenuItem disabled={!canTerminate(stakeholder)} onClick={onTerminate}>
                <TerminateLabel blocked={terminateBlocked(stakeholder)} />
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
      <Tabs defaultValue="overview">
        <TabsList>
          <TabsTrigger value="overview">{t`Overview`}</TabsTrigger>
          <TabsTrigger value="holdings">{t`Holdings`}</TabsTrigger>
          <TabsTrigger value="history">{t`Relationship history`}</TabsTrigger>
        </TabsList>
        <TabsContent value="overview" className="grid gap-6 pt-4 md:grid-cols-2">
          <SectionCard title={t`Basic information`}>
            <Fields
              rows={[
                [t`Type`, individual ? t`Individual` : t`Organization`],
                [t`Contact email`, stakeholder.contactEmail],
                [t`Portfolio email`, stakeholder.portfolioEmail],
                [t`Other emails`, stakeholder.otherEmails.join(", ")],
                ...(individual
                  ? ([[t`Date of birth`, stakeholder.dateOfBirth]] as [string, string | null][])
                  : []),
                [t`Tax ID`, stakeholder.taxId ? `•••• ${stakeholder.taxId.slice(-4)}` : null],
                [t`Employee ID`, stakeholder.employeeId],
              ]}
            />
          </SectionCard>
          <SectionCard title={t`Properties`}>
            <Fields
              rows={[
                [
                  t`Relationship`,
                  stakeholder.relationship && relationshipLabel(stakeholder.relationship),
                ],
                [t`Job title`, stakeholder.jobTitle],
                [t`Cost center`, stakeholder.costCenter],
                [t`Department`, stakeholder.department],
                ...customProperties.map(
                  (property) =>
                    [property.name, stakeholder.customValues[property.id]] as [
                      string,
                      string | undefined,
                    ],
                ),
              ]}
            />
          </SectionCard>
          {address && Object.values(address).some(Boolean) && (
            <SectionCard title={t`Address`}>
              <Fields
                rows={[
                  [t`Country`, address?.country],
                  [t`Street`, address?.street],
                  [t`City`, address?.city],
                  [t`State/Province`, address?.state],
                  [t`Postal code`, address?.postalCode],
                ]}
              />
            </SectionCard>
          )}
        </TabsContent>
        <TabsContent value="holdings" className="pt-4">
          <HoldingsTab stakeholderId={stakeholder.id} />
        </TabsContent>
        <TabsContent value="history" className="pt-4">
          {periods.length === 0 ? (
            <CapTableEmptyState message={t`No relationship entered`} />
          ) : (
            <Table>
              <TableHeader>
                <TableHeadRow>
                  <TableHead>{t`Relationship`}</TableHead>
                  <TableHead>{t`From`}</TableHead>
                  <TableHead>{t`To`}</TableHead>
                </TableHeadRow>
              </TableHeader>
              <TableBody>
                {periods.map((period) => (
                  <TableRow key={period.id}>
                    <TableCell>{relationshipLabel(period.value)}</TableCell>
                    <TableCell>{period.from}</TableCell>
                    <TableCell>{period.to ?? t`Current`}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
