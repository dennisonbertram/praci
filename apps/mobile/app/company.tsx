import type {
  CompanyCalendarItem,
  CompanyFact,
  CompanyImportSession,
  CompanyPageData,
  CompanyReview,
} from "@rakazo/contracts";
import { companyFactIsVisible } from "@rakazo/contracts";
import { companyDate, companyFactTitle, companyHistoryItems } from "@rakazo/core";
import { router, Stack, useLocalSearchParams } from "expo-router";
import { useRef, useState } from "react";
import { ActivityIndicator, Alert, StyleSheet, Text, View } from "react-native";
import type { CompanyListRow } from "../components/company-list";
import { CompanyList } from "../components/company-list";
import { NativeActionButton } from "../components/native-action-button";
import { SettingsSwitch } from "../components/settings-group";
import { rpc } from "../lib/api";
import { companyCanCancel, companyCanPause, companyMonthOffset } from "../lib/company";
import { maskAmountsWhenHidden, setHideAmounts, useHideAmounts } from "../lib/hide-amounts";
import { useI18n } from "../lib/i18n";
import { native, useThemedStyles } from "../lib/native";
import { companyScope, useCompanyQuery } from "../lib/use-company-query";
import { errorText } from "../lib/user-error";

export default function CompanyScreen() {
  const { view = "overview" } = useLocalSearchParams<{ view?: string }>();
  const { t } = useI18n();
  const labels: Record<string, string> = {
    overview: t("Company"),
    people: t("People"),
    history: t("History"),
    calendar: t("Calendar"),
    review: t("Review"),
    progress: t("Import progress"),
  };
  return (
    <View style={{ flex: 1, backgroundColor: native.page }}>
      <Stack.Screen options={{ title: labels[view] ?? t("Company") }} />
      {view === "calendar" ? (
        <CompanyAgenda />
      ) : view === "review" ? (
        <CompanyReviewList />
      ) : view === "progress" ? (
        <CompanyProgress />
      ) : (
        <CompanyMap view={view} />
      )}
    </View>
  );
}

function openFact(kind: CompanyFact["kind"], id: string) {
  router.push({ pathname: "/company-fact", params: { kind, id } });
}

function CompanyMap({ view }: { view: string }) {
  const { t } = useI18n();
  const query = useCompanyQuery<CompanyPageData>("company/page");
  const hidden = useHideAmounts();
  const rows: CompanyListRow[] = [];
  const data = query.data;
  if (data) {
    const entities = data.entities.filter(companyFactIsVisible);
    const edges = data.edges.filter(companyFactIsVisible);
    const events = data.events.filter(companyFactIsVisible);
    if (view === "people") {
      for (const person of entities.filter((entity) => entity.kind === "person")) {
        rows.push({
          id: person.id,
          title: maskAmountsWhenHidden(person.displayName),
          detail: person.status === "confirmed" ? t("Confirmed") : t("Not confirmed"),
          onPress: () => openFact("entity", person.id),
        });
        for (const edge of edges.filter(
          (edge) => edge.fromId === person.id && edge.relation === "works_at",
        ))
          rows.push({
            id: `role:${edge.id}`,
            title: maskAmountsWhenHidden(edge.role ?? t("Role")),
            detail: `${companyDate(edge.startsOn)} – ${edge.endsOn ? companyDate(edge.endsOn) : t("Present")}`,
            onPress: () => openFact("edge", edge.id),
          });
      }
    } else if (view === "history") {
      for (const item of companyHistoryItems({ entities, edges, events }).sort((a, b) =>
        b.start.date.localeCompare(a.start.date),
      ))
        rows.push({
          id: `${item.kind}:${item.id}`,
          title: maskAmountsWhenHidden(item.title),
          detail: `${companyDate(item.start)}${item.period ? ` – ${item.end ? companyDate(item.end) : t("Present")}` : ""} · ${item.status === "confirmed" ? t("Confirmed") : t("Not confirmed")}`,
          onPress: () => openFact(item.kind, item.id),
        });
    } else {
      rows.push({ id: "reconstructed", title: t("Reconstructed") });
      for (const entity of entities.filter((entity) => entity.kind === "company"))
        rows.push({
          id: entity.id,
          title: maskAmountsWhenHidden(entity.displayName),
          detail:
            typeof entity.attrs.description === "string"
              ? maskAmountsWhenHidden(entity.attrs.description)
              : undefined,
          onPress: () => openFact("entity", entity.id),
        });
      if (!entities.length && !events.length)
        rows.push({
          id: "empty",
          title: t("No company facts yet"),
          detail: t("Start an import on web or desktop."),
        });
      const destinations = [
        {
          key: "people",
          title: t("People"),
          detail: String(entities.filter((entity) => entity.kind === "person").length),
        },
        { key: "history", title: t("History") },
        { key: "calendar", title: t("Calendar") },
        { key: "review", title: t("Review") },
        {
          key: "progress",
          title: t("Import progress"),
          detail: data.latestRun?.status.replaceAll("_", " "),
        },
      ];
      rows.push(
        ...destinations.map(({ key, title, detail }) => ({
          id: key,
          title,
          detail,
          onPress: () => router.push({ pathname: "/company", params: { view: key } }),
        })),
      );
      for (const entity of entities.filter((entity) => entity.kind === "organisation"))
        rows.push({
          id: entity.id,
          title: maskAmountsWhenHidden(entity.displayName),
          detail: t("Organisation"),
          onPress: () => openFact("entity", entity.id),
        });
    }
  }
  return (
    <>
      <QueryStatus {...query} />
      {view === "overview" ? (
        <SettingsSwitch
          label={t("Hide amounts")}
          value={hidden}
          onChange={(value) => void setHideAmounts(value)}
        />
      ) : null}
      <CompanyList
        rows={rows}
        empty={query.loading || query.error ? "" : t("No company facts yet")}
      />
    </>
  );
}

function CompanyAgenda() {
  const { t } = useI18n();
  useHideAmounts();
  const now = new Date();
  const [month, setMonth] = useState(
    `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`,
  );
  const [anniversaries, setAnniversaries] = useState(false);
  const query = useCompanyQuery<CompanyCalendarItem[]>("company/calendar", {
    month,
    anniversaries,
  });
  return (
    <>
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          padding: 12,
        }}
      >
        <NativeActionButton
          label={t("Previous month")}
          prominence="plain"
          fill={false}
          onPress={() => setMonth(companyMonthOffset(month, -1))}
        />
        <Text style={{ color: native.label }}>{month}</Text>
        <NativeActionButton
          label={t("Next month")}
          prominence="plain"
          fill={false}
          onPress={() => setMonth(companyMonthOffset(month, 1))}
        />
      </View>
      <SettingsSwitch
        label={t("Anniversaries")}
        value={anniversaries}
        onChange={setAnniversaries}
      />
      <QueryStatus {...query} />
      <CompanyList
        empty={query.loading || query.error ? "" : t("No dates this month")}
        rows={(query.data ?? []).map((item) => ({
          id: item.id,
          title: maskAmountsWhenHidden(item.title),
          detail: `${item.date}${item.legalDeadlineId ? ` · ${t("Legal")}` : item.status === "suggested" ? ` · ${t("Not confirmed")}` : ""}`,
          onPress: item.fact
            ? () => openFact(item.fact!.kind, item.fact!.id)
            : () =>
                Alert.alert(
                  t("Legal deadline"),
                  t("Open Legal on web or desktop to update this deadline."),
                ),
        }))}
      />
    </>
  );
}

function CompanyReviewList() {
  const { t } = useI18n();
  useHideAmounts();
  const query = useCompanyQuery<CompanyReview>("company/review");
  const [busy, setBusy] = useState(false);
  const pending = useRef(false);
  const scope = companyScope();
  async function act(fact: CompanyFact, action: "confirm" | "reject") {
    if (pending.current || fact.record.readOnly || scope !== companyScope()) return;
    pending.current = true;
    setBusy(true);
    try {
      await rpc(`company/${action}`, { kind: fact.kind, id: fact.record.id });
      if (scope === companyScope()) query.reload();
    } catch (error) {
      if (scope === companyScope()) Alert.alert(t("Company"), errorText(error));
    } finally {
      pending.current = false;
      setBusy(false);
    }
  }
  return (
    <>
      <QueryStatus {...query} />
      <CompanyList
        pending={busy}
        empty={query.loading || query.error ? "" : t("Nothing to review")}
        rows={(query.data?.items ?? []).map((item) =>
          item.kind === "candidate"
            ? {
                id: item.id,
                title: maskAmountsWhenHidden(item.candidate.title),
                detail: t("Choose a match"),
                onPress: () =>
                  router.push({
                    pathname: "/company-fact",
                    params: { kind: "candidate", id: item.candidate.id },
                  }),
              }
            : {
                id: item.id,
                title: maskAmountsWhenHidden(companyFactTitle(item.fact)),
                detail:
                  item.reason === "contradiction" ? t("Conflicting evidence") : t("Not confirmed"),
                onPress: () =>
                  router.push({
                    pathname: "/company-fact",
                    params: { kind: item.fact.kind, id: item.fact.record.id, origin: "review" },
                  }),
                ...(!item.fact.record.readOnly
                  ? {
                      onConfirm: () => void act(item.fact, "confirm"),
                      onReject: () =>
                        Alert.alert(
                          t("Reject fact?"),
                          maskAmountsWhenHidden(companyFactTitle(item.fact)),
                          [
                            { text: t("Cancel"), style: "cancel" },
                            {
                              text: t("Reject"),
                              style: "destructive",
                              onPress: () => void act(item.fact, "reject"),
                            },
                          ],
                        ),
                    }
                  : {}),
              },
        )}
      />
    </>
  );
}

function CompanyProgress() {
  const { t } = useI18n();
  const query = useCompanyQuery<CompanyImportSession | null>("companyImport/session", {}, true);
  const [busy, setBusy] = useState(false);
  const pending = useRef(false);
  const progress = query.data?.progress;
  const scope = companyScope();
  async function act(action: "pause" | "cancel") {
    if (!progress || pending.current || scope !== companyScope()) return;
    pending.current = true;
    setBusy(true);
    try {
      await rpc("companyImport/action", { runId: progress.runId, action });
      if (scope === companyScope()) query.reload();
    } catch (error) {
      if (scope === companyScope()) Alert.alert(t("Import progress"), errorText(error));
    } finally {
      pending.current = false;
      setBusy(false);
    }
  }
  return (
    <>
      <QueryStatus {...query} />
      {progress ? (
        <View style={{ padding: 16, gap: 12 }}>
          <Text style={{ color: native.label }}>{progress.status.replaceAll("_", " ")}</Text>
          <Text style={{ color: native.secondaryLabel }}>
            {t("Tokens")}: {progress.inputTokensUsed + progress.outputTokensUsed} /{" "}
            {progress.tokenCap}
          </Text>
          {progress.budgetWarning ? (
            <Text style={{ color: native.secondaryLabel }}>{t("Near token cap")}</Text>
          ) : null}
          <View style={{ flexDirection: "row", gap: 12 }}>
            {companyCanPause(progress.status) ? (
              <NativeActionButton
                label={t("Pause")}
                busy={busy}
                fill={false}
                onPress={() => void act("pause")}
              />
            ) : null}
            {companyCanCancel(progress.status) ? (
              <NativeActionButton
                label={t("Cancel import")}
                prominence="destructive"
                busy={busy}
                fill={false}
                onPress={() =>
                  Alert.alert(t("Cancel import?"), t("Imported facts stay."), [
                    { text: t("Keep importing"), style: "cancel" },
                    {
                      text: t("Cancel import"),
                      style: "destructive",
                      onPress: () => void act("cancel"),
                    },
                  ])
                }
              />
            ) : null}
          </View>
        </View>
      ) : null}
      <CompanyList
        empty={query.loading || query.error ? "" : t("Start an import on web or desktop.")}
        rows={(progress?.sources ?? []).map((source) => ({
          id: source.id,
          title:
            query.data?.sources.find((entry) => entry.id === source.id)?.label ?? source.sourceKind,
          detail: `${source.status.replaceAll("_", " ")} · ${source.itemsRead} / ${source.itemsDiscovered} ${t("items")} · ${source.factsFound} ${t("facts")} · ${source.inputTokensUsed + source.outputTokensUsed} ${t("tokens")}${source.lastError ? ` · ${source.lastError}` : ""}`,
        }))}
      />
    </>
  );
}

function QueryStatus({
  loading,
  error,
  reload,
}: {
  loading: boolean;
  error: string;
  reload: () => void;
}) {
  const { t } = useI18n();
  const styles = useThemedStyles(() =>
    StyleSheet.create({ status: { padding: 16, gap: 8 }, text: { color: native.secondaryLabel } }),
  );
  return (
    <View style={styles.status}>
      {loading ? <ActivityIndicator /> : null}
      {error ? (
        <Text accessibilityRole="alert" style={styles.text}>
          {error}
        </Text>
      ) : null}
      <NativeActionButton
        label={error ? t("Try again.") : t("Refresh")}
        prominence="quiet"
        onPress={reload}
        disabled={loading}
      />
    </View>
  );
}
