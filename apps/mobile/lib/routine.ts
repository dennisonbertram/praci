import type { Routine } from "@rakazo/contracts";
import { formatCron } from "@rakazo/core";
import { dateLocaleForUi, t } from "./i18n";

function watchHost(url: string): string {
  try {
    return new URL(url).host;
  } catch {
    return url;
  }
}

function ago(iso: string, now: Date): string {
  const minutes = Math.max(0, Math.round((now.getTime() - new Date(iso).getTime()) / 60_000));
  const rtf = new Intl.RelativeTimeFormat(dateLocaleForUi(), { numeric: "auto" });
  if (minutes < 60) return rtf.format(-minutes, "minute");
  if (minutes < 1440) return rtf.format(-Math.round(minutes / 60), "hour");
  return rtf.format(-Math.round(minutes / 1440), "day");
}

/** The second line: when a schedule last ran and runs next, or when a watch last checked and changed. */
export function routineActivityLine(routine: Routine, now = new Date()): string | null {
  const { status } = routine;
  const when = (iso: string) =>
    new Date(iso).toLocaleString(dateLocaleForUi(), {
      weekday: "short",
      hour: "numeric",
      minute: "2-digit",
      timeZone: routine.timezone,
    });
  if (status.pausedReason) {
    return {
      errors: t("Paused: the page could not be checked"),
      noisy: t("Paused: the page changes too often"),
      access: t("Paused: no access"),
      budget: t("Paused: too many checks today"),
      credit: t("Paused: model connection out of credit"),
    }[status.pausedReason];
  }
  const failed = status.lastRunFailed && t("Last run failed");
  const parts = routine.watch
    ? [
        failed,
        status.lastCheckedAt && `${t("Checked")} ${ago(status.lastCheckedAt, now)}`,
        status.lastChangedAt && `${t("Changed")} ${ago(status.lastChangedAt, now)}`,
      ]
    : [
        failed ||
          ((status.lastRunAt ?? routine.lastRunAt) &&
            `${t("Last ran")} ${when((status.lastRunAt ?? routine.lastRunAt) as string)}`),
        status.nextRunAt && routine.active && `${t("Next")} ${when(status.nextRunAt)}`,
      ];
  return parts.filter(Boolean).join(" · ") || null;
}

export function routineStatusLine(routine: Routine): string {
  const triggers = [
    ...(routine.watch
      ? [
          `${t("Watches")} ${
            routine.watch.kind === "connector"
              ? routine.watch.appName
              : watchHost(routine.watch.url)
          }`,
        ]
      : []),
    ...(routine.managedKind === "check_in" ? [t("Check-in")] : []),
    ...routine.crons.map(formatCron),
    ...(routine.webhookEnabled ? [t("Webhook")] : []),
    ...(routine.githubEnabled ? [t("Git event")] : []),
    ...(routine.messageProvider === "slack"
      ? [t("Slack message")]
      : routine.messageProvider === "teams"
        ? [t("Teams message")]
        : routine.messageProvider
          ? [t("Message event")]
          : []),
  ].join(", ");
  return [routine.active ? t("Active") : t("Paused"), triggers, routine.timezone]
    .filter(Boolean)
    .join(" · ");
}
