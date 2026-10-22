import { t } from "@lingui/core/macro";
import { Trans } from "@lingui/react/macro";
import type { GtmOverview } from "@rakazo/contracts";
import { GTM_CHANNELS } from "@rakazo/contracts";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@rakazo/ui-web";

export function GtmChannels({ overview }: { overview: GtmOverview }) {
  const policy = overview.directoryPolicy;
  const statuses = {
    connected: t`Connected`,
    not_connected: t`Not connected`,
    unavailable: t`Unavailable`,
    ready: t`Ready`,
    draft_only: t`Draft only`,
  };
  const rows: {
    key: string;
    label: string;
    destination: string;
    rule: string;
    status: GtmOverview["channels"][number]["status"];
  }[] = [];
  for (const row of overview.channels) {
    const channel = GTM_CHANNELS[row.channel];
    const directory = row.channel === "directory";
    const email = row.channel === "email";
    const draft = channel.approval === "draft_only";
    const destination = directory
      ? t`Browser`
      : email
        ? overview.gmailAccounts.map((account) => account.address ?? account.label).join(", ") ||
          t`Inbox (Gmail)`
        : draft
          ? t`Draft only`
          : row.accounts.map((account) => account.label).join(", ") || "Zernio";
    const rule = directory
      ? t`${policy.founderApprovals} of ${policy.approvalsBeforeAuto} approvals before auto · ${policy.autoOpenings} of ${policy.dailyCap} today`
      : draft
        ? "—"
        : email
          ? t`Approve every email`
          : t`Approve every post`;
    // Channels with the same unconnected or draft-only state read as one row.
    const same = rows.find(
      (other) =>
        (row.status === "not_connected" || draft) &&
        other.status === row.status &&
        other.destination === destination &&
        other.rule === rule,
    );
    if (same) same.label += `, ${channel.label}`;
    else
      rows.push({ key: row.channel, label: channel.label, destination, rule, status: row.status });
  }
  return (
    <section aria-label={t`Channels`} className="rounded-xl border border-border">
      <h2 className="px-4 pt-4 text-sm font-semibold">
        <Trans>Channels</Trans>
      </h2>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="ps-4">
              <Trans>Channel</Trans>
            </TableHead>
            <TableHead>
              <Trans>Destination</Trans>
            </TableHead>
            <TableHead className="hidden sm:table-cell">
              <Trans>Rule</Trans>
            </TableHead>
            <TableHead>
              <Trans>Status</Trans>
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row) => {
            return (
              <TableRow key={row.key}>
                <TableCell className="ps-4 font-medium">{row.label}</TableCell>
                <TableCell className="max-w-48 whitespace-normal break-words text-muted-foreground">
                  {row.destination}
                  <span className="mt-1 block text-xs sm:hidden">{row.rule}</span>
                </TableCell>
                <TableCell className="hidden max-w-64 whitespace-normal text-xs text-muted-foreground sm:table-cell">
                  {row.rule}
                </TableCell>
                <TableCell
                  className={
                    row.status === "connected" || row.status === "ready"
                      ? "text-success"
                      : "text-muted-foreground"
                  }
                >
                  {statuses[row.status]}
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </section>
  );
}
