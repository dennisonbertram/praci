import type {
  CompanyFact,
  CompanyPageData,
  CompanyReview,
  CompanyReviewCandidate,
} from "@rakazo/contracts";
import {
  CompanyEdgeEditInputSchema,
  CompanyEntityEditInputSchema,
  CompanyEventEditInputSchema,
  companyFactIsVisible,
  companyInboxSourceMessageId,
} from "@rakazo/contracts";
import { companyDate, companyFactTitle } from "@rakazo/core";
import { router, Stack, useLocalSearchParams } from "expo-router";
import { useRef, useState } from "react";
import { ActivityIndicator, Alert, Linking, ScrollView, Text, TextInput, View } from "react-native";
import { MenuPicker } from "../components/menu-picker";
import { NativeActionButton } from "../components/native-action-button";
import { SettingsGroup, SettingsRow } from "../components/settings-group";
import { rpc } from "../lib/api";
import { companyReviewDecision } from "../lib/company";
import { maskAmountsWhenHidden, useHideAmounts } from "../lib/hide-amounts";
import { useI18n } from "../lib/i18n";
import { native } from "../lib/native";
import { companyScope, useCompanyQuery } from "../lib/use-company-query";
import { errorText } from "../lib/user-error";

export default function CompanyFactScreen() {
  const { kind, id, origin } = useLocalSearchParams<{
    kind: string;
    id: string;
    origin?: string;
  }>();
  const { t } = useI18n();
  const candidate = kind === "candidate";
  const reviewFact = origin === "review" && !candidate;
  const query = useCompanyQuery<CompanyFact | CompanyReview | null>(
    candidate || reviewFact ? "company/review" : "company/fact",
    candidate || reviewFact ? {} : { kind, id },
  );
  const reviewFactItem =
    reviewFact && query.data && "items" in query.data
      ? query.data.items.find(
          (item) => item.kind === "fact" && item.fact.kind === kind && item.fact.record.id === id,
        )
      : null;
  const fact =
    (query.data && "record" in query.data ? query.data : null) ??
    (reviewFactItem?.kind === "fact" ? reviewFactItem.fact : null);
  const item =
    query.data && "items" in query.data
      ? query.data.items.find((item) => item.kind === "candidate" && item.candidate.id === id)
      : null;
  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: native.groupedPage }}
      contentContainerStyle={{ padding: 16, gap: 16 }}
      contentInsetAdjustmentBehavior="automatic"
    >
      <Stack.Screen options={{ title: t("Fact detail") }} />
      <NativeActionButton label={t("Done")} prominence="quiet" onPress={() => router.back()} />
      {query.loading ? (
        <ActivityIndicator />
      ) : query.error ? (
        <>
          <Text accessibilityRole="alert" style={{ color: native.secondaryLabel }}>
            {query.error}
          </Text>
          <NativeActionButton label={t("Try again.")} onPress={query.reload} />
        </>
      ) : fact ? (
        <FactDetail key={`${kind}:${id}`} fact={fact} />
      ) : item?.kind === "candidate" ? (
        <CandidateDetail key={`${item.id}:${item.candidate.version}`} candidate={item.candidate} />
      ) : (
        <Text style={{ color: native.secondaryLabel }}>{t("Fact unavailable")}</Text>
      )}
    </ScrollView>
  );
}

function useDecision() {
  const { t } = useI18n();
  const [busy, setBusy] = useState(false);
  const pending = useRef(false);
  const scope = companyScope();
  const run = async (procedure: string, input: object) => {
    if (pending.current || scope !== companyScope()) return;
    pending.current = true;
    setBusy(true);
    try {
      await rpc(procedure, input);
      if (scope === companyScope()) router.back();
    } catch (error) {
      if (scope === companyScope()) Alert.alert(t("Company"), errorText(error));
    } finally {
      pending.current = false;
      setBusy(false);
    }
  };
  return { busy, run };
}

function FactDetail({ fact }: { fact: CompanyFact }) {
  const { t } = useI18n();
  const hidden = useHideAmounts();
  const { busy, run } = useDecision();
  const [editing, setEditing] = useState(false);
  const originalTitle =
    fact.kind === "entity"
      ? fact.record.displayName
      : fact.kind === "event"
        ? fact.record.title
        : (fact.record.role ?? "");
  const [title, setTitle] = useState(originalTitle);
  const record = fact.record;
  const normalizedTitle = title.trim();
  const unchanged = normalizedTitle === originalTitle.trim();
  const editInput =
    fact.kind === "entity"
      ? CompanyEntityEditInputSchema.safeParse({
          entityId: record.id,
          kind: fact.record.kind,
          displayName: normalizedTitle,
        })
      : fact.kind === "event"
        ? CompanyEventEditInputSchema.safeParse({
            eventId: record.id,
            title: normalizedTitle,
          })
        : CompanyEdgeEditInputSchema.safeParse({
            edgeId: record.id,
            role: normalizedTitle || null,
          });
  const validEdit = editInput.success && !unchanged;
  const map = useCompanyQuery<CompanyPageData>("company/page");
  const relationships = (map.data?.edges ?? []).filter(
    (edge) => companyFactIsVisible(edge) && (edge.fromId === record.id || edge.toId === record.id),
  );
  const ref = { kind: fact.kind, id: record.id };
  function save() {
    if (!validEdit || !editInput.success) return;
    if (fact.kind === "entity") void run("company/editEntity", editInput.data);
    else if (fact.kind === "event") void run("company/editEvent", editInput.data);
    else void run("company/editEdge", editInput.data);
  }
  return (
    <>
      <SettingsGroup>
        <SettingsRow
          title={maskAmountsWhenHidden(companyFactTitle(fact))}
          detail={record.status === "confirmed" ? t("Confirmed") : t("Not confirmed")}
        />
        <SettingsRow title={t("Confidence")} value={`${Math.round(record.confidence * 100)}%`} />
        {fact.kind === "entity" ? (
          Object.entries(fact.record.attrs).map(([name, value]) => (
            <SettingsRow
              key={name}
              title={name.replaceAll("_", " ")}
              detail={maskAmountsWhenHidden(
                typeof value === "string" ? value : JSON.stringify(value),
              )}
            />
          ))
        ) : (
          <SettingsRow
            title={t("Dates")}
            detail={
              fact.kind === "event"
                ? `${companyDate(fact.record.occursOn)}${fact.record.endsOn ? ` – ${companyDate(fact.record.endsOn)}` : ""}`
                : `${companyDate(fact.record.startsOn)} – ${fact.record.endsOn ? companyDate(fact.record.endsOn) : t("Present")}`
            }
          />
        )}
      </SettingsGroup>
      {fact.kind === "entity" && relationships.length ? (
        <SettingsGroup label={t("Relationships")}>
          {relationships.map((edge) => (
            <SettingsRow
              key={edge.id}
              title={maskAmountsWhenHidden(edge.role ?? edge.relation.replaceAll("_", " "))}
              detail={`${companyDate(edge.startsOn)} – ${edge.endsOn ? companyDate(edge.endsOn) : t("Present")}`}
              onPress={() =>
                router.push({ pathname: "/company-fact", params: { kind: "edge", id: edge.id } })
              }
              chevron="right"
            />
          ))}
        </SettingsGroup>
      ) : null}
      {!record.readOnly ? (
        <>
          {editing && !hidden ? (
            <View style={{ gap: 12 }}>
              <TextInput
                accessibilityLabel={fact.kind === "edge" ? t("Role") : t("Name or title")}
                value={title}
                onChangeText={setTitle}
                editable={!busy}
                maxLength={200}
                style={{
                  color: native.label,
                  backgroundColor: native.groupedCell,
                  padding: 16,
                  fontSize: 17,
                }}
              />
              <NativeActionButton
                label={t("Save")}
                onPress={save}
                busy={busy}
                disabled={!validEdit}
              />
            </View>
          ) : null}
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 12 }}>
            <NativeActionButton
              label={t("Confirm")}
              fill={false}
              busy={busy}
              onPress={() => void run("company/confirm", ref)}
            />
            <NativeActionButton
              label={t("Edit")}
              fill={false}
              prominence="secondary"
              disabled={busy || hidden}
              onPress={() => setEditing(!editing)}
            />
            <NativeActionButton
              label={t("Reject")}
              fill={false}
              prominence="destructive"
              busy={busy}
              onPress={() =>
                Alert.alert(t("Reject fact?"), maskAmountsWhenHidden(companyFactTitle(fact)), [
                  { text: t("Cancel"), style: "cancel" },
                  {
                    text: t("Reject"),
                    style: "destructive",
                    onPress: () => void run("company/reject", ref),
                  },
                ])
              }
            />
          </View>
        </>
      ) : null}
      {record.evidence.map((evidence) => (
        <SettingsGroup
          key={evidence.id}
          label={evidence.stance === "contradicts" ? t("Conflicting evidence") : t("Evidence")}
        >
          <SettingsRow
            title={evidence.sourceKind.replaceAll("_", " ")}
            detail={maskAmountsWhenHidden(evidence.quote)}
          />
          <SettingsRow title={t("Extracted")} detail={evidence.extractedAt} />
          {evidence.extractorModel ? (
            <SettingsRow
              title={t("Model")}
              detail={maskAmountsWhenHidden(JSON.stringify(evidence.extractorModel))}
            />
          ) : null}
          {evidence.sourceUrl &&
          (/^https?:\/\//i.test(evidence.sourceUrl) ||
            companyInboxSourceMessageId(evidence.sourceUrl) !== null) ? (
            <SettingsRow
              title={t("Open source")}
              onPress={() => {
                const messageId = companyInboxSourceMessageId(evidence.sourceUrl!);
                if (messageId) {
                  router.push({ pathname: "/inbox-message", params: { messageId } });
                } else {
                  void Linking.openURL(evidence.sourceUrl!).catch((error: unknown) =>
                    Alert.alert(t("Open source"), errorText(error)),
                  );
                }
              }}
              chevron="right"
            />
          ) : null}
        </SettingsGroup>
      ))}
    </>
  );
}

function CandidateDetail({ candidate }: { candidate: CompanyReviewCandidate }) {
  const { t } = useI18n();
  const hidden = useHideAmounts();
  const { busy, run } = useDecision();
  const [target, setTarget] = useState("");
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(candidate.title);
  const [subjects, setSubjects] = useState<Record<string, string>>(() =>
    Object.fromEntries(candidate.subjects.map((subject) => [subject.ref, subject.entityId ?? ""])),
  );
  const decision = companyReviewDecision(
    candidate,
    "confirm",
    target,
    subjects,
    editing ? title : undefined,
  );
  const choose = { key: "", label: t("Choose…") };
  return (
    <>
      <SettingsGroup>
        <SettingsRow
          title={maskAmountsWhenHidden(candidate.title)}
          detail={candidate.reason.replaceAll("_", " ")}
        />
        <SettingsRow title={candidate.sourceKind} detail={maskAmountsWhenHidden(candidate.quote)} />
        {candidate.details.map((detail, index) => (
          <SettingsRow
            key={`${detail.label}:${index}`}
            title={detail.label}
            detail={maskAmountsWhenHidden(detail.value)}
          />
        ))}
      </SettingsGroup>
      {candidate.choices.length || candidate.allowSeparate ? (
        <MenuPicker
          label={t("Match")}
          value={target}
          onChange={(value) => {
            if (!busy) setTarget(value);
          }}
          choices={[
            choose,
            ...candidate.choices.map((choice) => ({
              key: choice.id,
              label: maskAmountsWhenHidden(choice.title),
            })),
            ...(candidate.allowSeparate ? [{ key: "separate", label: t("Keep separate") }] : []),
          ]}
        />
      ) : null}
      {candidate.subjects.map((subject) => (
        <MenuPicker
          key={subject.ref}
          label={maskAmountsWhenHidden(subject.title)}
          value={subjects[subject.ref] ?? ""}
          choices={[
            choose,
            ...candidate.subjectChoices.map((choice) => ({
              key: choice.id,
              label: maskAmountsWhenHidden(choice.title),
            })),
          ]}
          onChange={(value) => {
            if (!busy) setSubjects((current) => ({ ...current, [subject.ref]: value }));
          }}
        />
      ))}
      {candidate.editableTitle && !hidden ? (
        <>
          <NativeActionButton
            label={t("Edit")}
            prominence="quiet"
            disabled={busy}
            onPress={() => setEditing(!editing)}
          />
          {editing ? (
            <TextInput
              accessibilityLabel={t("Name or title")}
              editable={!busy}
              value={title}
              onChangeText={setTitle}
              maxLength={240}
              style={{ padding: 16, color: native.label, backgroundColor: native.groupedCell }}
            />
          ) : null}
        </>
      ) : null}
      <NativeActionButton
        label={t("Confirm")}
        busy={busy}
        disabled={!decision}
        onPress={() => {
          if (decision) void run("company/resolveCandidate", decision);
        }}
      />
      <NativeActionButton
        label={t("Reject")}
        prominence="destructive"
        busy={busy}
        onPress={() =>
          Alert.alert(t("Reject fact?"), maskAmountsWhenHidden(candidate.title), [
            { text: t("Cancel"), style: "cancel" },
            {
              text: t("Reject"),
              style: "destructive",
              onPress: () =>
                void run("company/resolveCandidate", {
                  candidateId: candidate.id,
                  version: candidate.version,
                  action: "reject",
                }),
            },
          ])
        }
      />
    </>
  );
}
