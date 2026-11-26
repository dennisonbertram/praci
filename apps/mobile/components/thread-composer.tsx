import type { MenuAction } from "@expo/ui/community/menu";
import { MenuView } from "@expo/ui/community/menu";
import type { AgentSkillCatalogEntry } from "@rakazo/contracts";
import type { buildComposerMentionOptions, ComposerMention, MentionSpan } from "@rakazo/core";
import {
  findMentionQueryAtCaret,
  insertInlineMention,
  liveSpans,
  mapSpans,
  mentionChipKey,
  pickMentionOptions,
  SLASH_ACTIONS,
  SLASH_INSERTS,
  serializeComposerPrompt,
  shiftSpans,
  truncateSlashDescription,
} from "@rakazo/core";
import type { Ref } from "react";
import { useImperativeHandle, useMemo, useRef, useState } from "react";
import type { ViewStyle } from "react-native";
import { Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { useAccentedTokens } from "../lib/bot-accent";
import { caretAfterChange } from "../lib/composer-caret";
import { useI18n } from "../lib/i18n";
import { useMobileTokens, useResolvedAppearance } from "../lib/native";
import type { MobileSlashActionId } from "../lib/slash-actions";
import type { ComposerSnapshot } from "../lib/thread-feedback";
import { GlassSurface } from "./glass-surface";
import { NativeSymbol } from "./native-symbol";

export type ThreadComposerHandle = {
  snapshot: () => ComposerSnapshot;
  reset: () => void;
};

type ThreadComposerProps = {
  ref: Ref<ThreadComposerHandle>;
  agentSkills: AgentSkillCatalogEntry[];
  composerMentionTargets: ReturnType<typeof buildComposerMentionOptions>;
  composerPrompt: string;
  replyTargetId?: string;
  replyQuote: string | null;
  attachmentIds: string[];
  botId?: string;
  onCall: boolean;
  working: boolean;
  sending: boolean;
  styles: { circleButton: ViewStyle; composerFill: ViewStyle };
  attachActions: MenuAction[];
  attachFrom: (source: string) => void;
  send: () => Promise<void>;
  stop: () => Promise<void>;
  startVoiceCall: () => Promise<void>;
  onSlashAction: (action: MobileSlashActionId) => void;
};

export function ThreadComposer({
  ref,
  agentSkills,
  composerMentionTargets,
  composerPrompt,
  replyTargetId,
  replyQuote,
  attachmentIds,
  botId,
  onCall,
  working,
  sending,
  styles,
  attachActions,
  attachFrom,
  send,
  stop,
  startVoiceCall,
  onSlashAction,
}: ThreadComposerProps) {
  const tokens = useAccentedTokens();
  const colorScheme = useResolvedAppearance();
  const { t } = useI18n();
  const [draft, setDraft] = useState("");
  const [mentionQuery, setMentionQuery] = useState<string | null>(null);
  // The `@query` a pick would replace; kept apart from the caret so a stale selection cannot move it.
  const mentionAnchor = useRef<{ start: number; query: string } | null>(null);
  const [slashQuery, setSlashQuery] = useState<string | null>(null);
  // Each picked mention is tracked by where its token sits, the same way the web composer does.
  const [mentionSpans, setMentionSpans] = useState<MentionSpan<ComposerMention>[]>([]);
  const liveMentionSpans = useMemo(() => liveSpans(draft, mentionSpans), [draft, mentionSpans]);
  const selectedMentions = useMemo(
    () =>
      liveMentionSpans
        .map((span) => span.mention)
        .filter(
          (mention, index, all) =>
            all.findIndex((other) => mentionChipKey(other) === mentionChipKey(mention)) === index,
        ),
    [liveMentionSpans],
  );
  const [selectedSkill, setSelectedSkill] = useState<AgentSkillCatalogEntry | null>(null);
  const draftRef = useRef("");
  const caretRef = useRef(0);
  // A selection event right after a text change may still carry the caret from before it.
  const justChanged = useRef(false);
  const inputRef = useRef<TextInput>(null);
  useImperativeHandle(ref, () => ({
    snapshot: () => ({
      promptText: serializeComposerPrompt(draft, selectedSkill, selectedMentions),
      mentions: selectedMentions,
      skill: selectedSkill,
      replyTargetId,
      replyQuote,
      attachmentIds,
    }),
    reset: () => {
      setDraft("");
      draftRef.current = "";
      caretRef.current = 0;
      setMentionQuery(null);
      mentionAnchor.current = null;
      setSlashQuery(null);
      setSelectedSkill(null);
      setMentionSpans([]);
    },
  }));
  const mentionOptions = useMemo(() => {
    if (mentionQuery === null || composerMentionTargets.length === 0) return [];
    return pickMentionOptions(composerMentionTargets, mentionQuery, 10);
  }, [composerMentionTargets, mentionQuery]);
  const slashQueryNormalized = slashQuery?.trim().toLowerCase() ?? null;
  const slashSkillOptions =
    slashQuery !== null && mentionQuery === null
      ? agentSkills
          .filter((skill) => {
            if (!slashQueryNormalized) return true;
            return (
              skill.name.toLowerCase().includes(slashQueryNormalized) ||
              skill.description.toLowerCase().includes(slashQueryNormalized)
            );
          })
          .slice(0, 8)
      : [];
  const slashActionOptions =
    slashQuery !== null && mentionQuery === null
      ? [...SLASH_ACTIONS, ...(botId ? SLASH_INSERTS : [])].filter((action) => {
          if (!slashQueryNormalized) return true;
          const label = t(action.label);
          return (
            action.label.toLowerCase().includes(slashQueryNormalized) ||
            label.toLowerCase().includes(slashQueryNormalized)
          );
        })
      : [];
  function setQuery(value: string, caret: number) {
    const found = findMentionQueryAtCaret(value, caret);
    const next = found?.query ?? null;
    setMentionQuery((current) => (current === next ? current : next));
    mentionAnchor.current = found;
  }

  function updateDraft(value: string) {
    const previous = draftRef.current;
    const caret = caretAfterChange(previous, value, caretRef.current);
    justChanged.current = true;
    setMentionSpans((current) => shiftSpans(current, previous, value));
    setDraft(value);
    draftRef.current = value;
    caretRef.current = caret;
    if (value === "") setMentionSpans((current) => (current.length ? [] : current));
    setQuery(value, caret);
    const slashMatch = selectedSkill === null ? /^\/([^\n]*)$/.exec(value) : null;
    setSlashQuery(slashMatch ? (slashMatch[1] ?? "") : null);
  }

  function changeSelection(selection: { start: number; end: number }) {
    const afterChange = justChanged.current;
    justChanged.current = false;
    if (selection.start !== selection.end) {
      setMentionQuery(null);
      mentionAnchor.current = null;
      return;
    }
    // iOS can report a collapsed caret at 0 right after an edit, before the real one; the anchor still holds.
    if (
      afterChange &&
      selection.start === 0 &&
      draftRef.current.length > 0 &&
      mentionAnchor.current !== null
    ) {
      return;
    }
    caretRef.current = selection.start;
    setQuery(draftRef.current, selection.start);
  }

  function insertMention(mention: ComposerMention) {
    const current = draftRef.current;
    const anchor = mentionAnchor.current;
    let caret = current.length;
    if (
      anchor &&
      current.slice(anchor.start, anchor.start + 1 + anchor.query.length) === `@${anchor.query}`
    ) {
      caret = anchor.start + 1 + anchor.query.length;
    }
    const inserted = insertInlineMention(current, caret, mention);
    setDraft(inserted.text);
    draftRef.current = inserted.text;
    caretRef.current = inserted.caret;
    const delta = inserted.text.length - current.length;
    setMentionSpans((spans) => [
      ...mapSpans(spans, inserted.start, caret, delta),
      { mention, start: inserted.start, end: inserted.end },
    ]);
    setMentionQuery(null);
    mentionAnchor.current = null;
    requestAnimationFrame(() => inputRef.current?.setSelection(inserted.caret, inserted.caret));
  }

  /** Deletes every `@Name` token for a chip, with one following space, from the text. */
  function removeMention(mention: ComposerMention) {
    const key = mentionChipKey(mention);
    let text = draftRef.current;
    let spans = mentionSpans;
    // Deleting from the right keeps the earlier spans' offsets valid.
    const ordered = liveSpans(text, spans).sort((a, b) => b.start - a.start);
    for (const span of ordered) {
      if (mentionChipKey(span.mention) !== key) continue;
      const next = text.slice(span.end, span.end + 1) === " " ? span.end + 1 : span.end;
      text = text.slice(0, span.start) + text.slice(next);
      spans = mapSpans(
        spans.filter((other) => other !== span),
        span.start,
        next,
        span.start - next,
      );
      caretRef.current = span.start;
    }
    setDraft(text);
    draftRef.current = text;
    setMentionSpans(spans);
    setMentionQuery(null);
    mentionAnchor.current = null;
    inputRef.current?.setSelection(caretRef.current, caretRef.current);
  }

  function insertSkill(skill: AgentSkillCatalogEntry) {
    setSelectedSkill(skill);
    setDraft("");
    draftRef.current = "";
    caretRef.current = 0;
    setMentionSpans([]);
    mentionAnchor.current = null;
    setSlashQuery(null);
  }

  function removeLastChip() {
    setSelectedSkill(null);
  }

  function runSlashAction(action: MobileSlashActionId) {
    setSlashQuery(null);
    // Goal is a message the server runs, so it fills the draft; the other actions open a screen.
    const insert = SLASH_INSERTS.find((entry) => entry.id === action);
    if (insert) {
      setDraft(insert.text);
      draftRef.current = insert.text;
      caretRef.current = insert.text.length;
      return;
    }
    setDraft("");
    draftRef.current = "";
    onSlashAction(action);
  }

  const composerPillStyle = {
    width: 36,
    height: 28,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  } as const;

  const canSend =
    Boolean(draft.trim()) ||
    selectedSkill !== null ||
    selectedMentions.length > 0 ||
    attachmentIds.length > 0;

  return (
    <>
      {mentionOptions.length ? (
        <ScrollView
          testID="mention-picker"
          keyboardShouldPersistTaps="handled"
          style={{
            flexGrow: 0,
            flexShrink: 1,
            marginTop: 12,
            borderRadius: 14,
            borderWidth: 1,
            borderColor: tokens.border,
            backgroundColor: tokens.card,
            overflow: "hidden",
          }}
        >
          {mentionOptions.map((mention) => (
            <Pressable
              key={mentionChipKey(mention)}
              accessibilityLabel={t("@{name}", { name: mention.name })}
              onPress={() => insertMention(mention)}
              style={{
                flexDirection: "row",
                alignItems: "flex-start",
                gap: 10,
                paddingHorizontal: 14,
                paddingVertical: 10,
              }}
            >
              <MentionOptionIcon mention={mention} />
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={{ color: tokens.foreground, fontSize: 14 }}>@{mention.name}</Text>
                {mention.subtitle ? (
                  <Text
                    numberOfLines={1}
                    style={{
                      color: tokens.mutedForeground,
                      fontSize: 12.5,
                      marginTop: 2,
                    }}
                  >
                    {mention.subtitle}
                  </Text>
                ) : null}
              </View>
            </Pressable>
          ))}
        </ScrollView>
      ) : null}
      {slashSkillOptions.length || slashActionOptions.length ? (
        <ScrollView
          testID="slash-picker"
          keyboardShouldPersistTaps="handled"
          style={{
            flexGrow: 0,
            flexShrink: 1,
            marginTop: 12,
            borderRadius: 14,
            borderWidth: 1,
            borderColor: tokens.border,
            backgroundColor: tokens.card,
            overflow: "hidden",
          }}
        >
          {slashSkillOptions.map((skill) => (
            <Pressable
              key={skill.id}
              accessibilityLabel={t("Skill {name}", { name: skill.name })}
              onPress={() => insertSkill(skill)}
              style={{
                flexDirection: "row",
                alignItems: "flex-start",
                gap: 10,
                paddingHorizontal: 14,
                paddingVertical: 10,
              }}
            >
              <NativeSymbol
                ios="cube"
                android="cube-outline"
                size={16}
                color={tokens.mutedForeground}
              />
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={{ color: tokens.foreground, fontSize: 14 }}>{skill.name}</Text>
                <Text
                  numberOfLines={1}
                  style={{ color: tokens.mutedForeground, fontSize: 12.5, marginTop: 2 }}
                >
                  {truncateSlashDescription(skill.description)}
                </Text>
              </View>
            </Pressable>
          ))}
          {slashActionOptions.map((action) => (
            <Pressable
              key={action.id}
              accessibilityLabel={t(action.label)}
              onPress={() => runSlashAction(action.id)}
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: 10,
                paddingHorizontal: 14,
                paddingVertical: 10,
              }}
            >
              <NativeSymbol
                ios={action.id === "goal" ? "flag" : "gearshape"}
                android={action.id === "goal" ? "flag-outline" : "settings-outline"}
                size={16}
                color={tokens.mutedForeground}
              />
              <Text style={{ color: tokens.foreground, fontSize: 14 }}>{t(action.label)}</Text>
            </Pressable>
          ))}
        </ScrollView>
      ) : null}
      <View style={{ flexDirection: "row", alignItems: "flex-end", gap: 10, marginTop: 8 }}>
        <MenuView
          actions={attachActions}
          colorScheme={colorScheme}
          onPressAction={(event) => attachFrom(event.nativeEvent.event)}
        >
          <View
            accessible
            accessibilityRole="button"
            accessibilityLabel={t("Attach file")}
            style={{ width: 44, height: 44 }}
          >
            <GlassSurface
              shape="circle"
              style={styles.circleButton}
              fallbackStyle={styles.composerFill}
            >
              <NativeSymbol ios="plus" android="add" size={18} color={tokens.mutedForeground} />
            </GlassSurface>
          </View>
        </MenuView>
        <GlassSurface
          shape="roundedRectangle"
          style={{
            flex: 1,
            minHeight: 44,
            borderRadius: 22,
            flexDirection: "row",
            alignItems: "flex-end",
            paddingStart: 16,
            paddingEnd: 4,
          }}
          fallbackStyle={styles.composerFill}
        >
          <View
            style={{
              flex: 1,
              flexDirection: "row",
              flexWrap: "wrap",
              alignItems: "center",
              gap: 6,
            }}
          >
            {selectedSkill ? (
              <View
                testID="skill-chip"
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 6,
                  backgroundColor: tokens.muted,
                  borderRadius: 999,
                  paddingHorizontal: 10,
                  paddingVertical: 5,
                  maxWidth: "100%",
                }}
              >
                <NativeSymbol
                  ios="cube"
                  android="cube-outline"
                  size={13}
                  color={tokens.mutedForeground}
                />
                <Text
                  numberOfLines={1}
                  style={{ color: tokens.foreground, fontSize: 13, flexShrink: 1 }}
                >
                  {selectedSkill.name}
                </Text>
                <Pressable
                  accessibilityLabel={t("Remove skill {name}", { name: selectedSkill.name })}
                  hitSlop={8}
                  onPress={() => setSelectedSkill(null)}
                >
                  <NativeSymbol
                    ios="xmark"
                    android="close"
                    size={12}
                    color={tokens.mutedForeground}
                  />
                </Pressable>
              </View>
            ) : null}
            {selectedMentions.map((mention) => (
              <View
                key={mentionChipKey(mention)}
                testID="mention-chip"
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 6,
                  backgroundColor: tokens.muted,
                  borderRadius: 999,
                  paddingHorizontal: 10,
                  paddingVertical: 5,
                  maxWidth: "100%",
                }}
              >
                <MentionChipIcon mention={mention} />
                <Text
                  numberOfLines={1}
                  style={{ color: tokens.foreground, fontSize: 13, flexShrink: 1 }}
                >
                  {mention.name}
                </Text>
                <Pressable
                  accessibilityLabel={t("Remove mention {name}", { name: mention.name })}
                  hitSlop={8}
                  onPress={() => removeMention(mention)}
                >
                  <NativeSymbol
                    ios="xmark"
                    android="close"
                    size={12}
                    color={tokens.mutedForeground}
                  />
                </Pressable>
              </View>
            ))}
            <View style={{ flexGrow: 1, flexShrink: 1, minWidth: 96 }}>
              {!draft && !selectedSkill && !selectedMentions.length ? (
                <Text
                  numberOfLines={1}
                  importantForAccessibility="no"
                  accessibilityElementsHidden
                  accessible={false}
                  pointerEvents="none"
                  style={{
                    position: "absolute",
                    top: 11,
                    start: 0,
                    end: 0,
                    fontSize: 17,
                    lineHeight: 22,
                    color: tokens.mutedForeground,
                  }}
                >
                  {composerPrompt}
                </Text>
              ) : null}
              <TextInput
                ref={inputRef}
                value={draft}
                onChangeText={updateDraft}
                accessibilityLabel={composerPrompt}
                onSelectionChange={(event) => changeSelection(event.nativeEvent.selection)}
                onKeyPress={(event) => {
                  if (
                    event.nativeEvent.key === "Backspace" &&
                    draft.length === 0 &&
                    selectedSkill !== null
                  ) {
                    removeLastChip();
                  }
                }}
                keyboardAppearance={colorScheme}
                multiline
                textAlignVertical="top"
                blurOnSubmit={false}
                style={{
                  color: tokens.foreground,
                  fontSize: 17,
                  lineHeight: 22,
                  paddingTop: 11,
                  paddingBottom: 11,
                  maxHeight: 132,
                  writingDirection: "auto",
                }}
              />
            </View>
          </View>
          {!canSend && botId && !onCall ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t("Call Elio")}
              hitSlop={{ top: 8, bottom: 8, left: 4, right: 4 }}
              onPress={() => void startVoiceCall()}
              style={{ marginBottom: 8 }}
            >
              <GlassSurface
                tint={tokens.primary}
                style={composerPillStyle}
                fallbackStyle={{ backgroundColor: tokens.primary }}
              >
                <NativeSymbol
                  ios="waveform"
                  android="pulse-outline"
                  size={15}
                  color={tokens.primaryForeground}
                />
              </GlassSurface>
            </Pressable>
          ) : (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t("Send")}
              disabled={sending || !canSend}
              hitSlop={{ top: 8, bottom: 8, left: 4, right: 4 }}
              onPress={() => void send()}
              style={{ marginBottom: 8, opacity: sending || !canSend ? 0.5 : 1 }}
            >
              <GlassSurface
                tint={tokens.primary}
                style={composerPillStyle}
                fallbackStyle={{ backgroundColor: tokens.primary }}
              >
                <NativeSymbol
                  ios="arrow.up"
                  android="arrow-up"
                  size={15}
                  color={tokens.primaryForeground}
                />
              </GlassSurface>
            </Pressable>
          )}
        </GlassSurface>
        {working ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t("Stop")}
            disabled={sending}
            onPress={() => void stop()}
            style={{ width: 44, height: 44, opacity: sending ? 0.5 : 1 }}
          >
            <GlassSurface
              shape="circle"
              style={styles.circleButton}
              fallbackStyle={{ borderColor: tokens.border, borderWidth: 1 }}
            >
              <NativeSymbol ios="stop.fill" android="stop" size={15} color={tokens.foreground} />
            </GlassSurface>
          </Pressable>
        ) : null}
      </View>
    </>
  );
}

function MentionOptionIcon({ mention }: { mention: ComposerMention }) {
  const tokens = useMobileTokens();
  if (mention.kind === "routine") {
    return (
      <NativeSymbol ios="clock" android="time-outline" size={16} color={tokens.mutedForeground} />
    );
  }
  if (mention.kind === "connector") {
    return (
      <NativeSymbol
        ios="puzzlepiece.extension"
        android="extension-puzzle-outline"
        size={16}
        color={tokens.mutedForeground}
      />
    );
  }
  if (mention.kind === "group") {
    return (
      <View
        style={{
          width: 16,
          height: 16,
          borderRadius: 8,
          backgroundColor: tokens.muted,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Text style={{ color: tokens.foreground, fontSize: 9 }}>G</Text>
      </View>
    );
  }
  if (mention.kind === "everyone") {
    return (
      <View
        style={{
          width: 16,
          height: 16,
          borderRadius: 8,
          backgroundColor: tokens.muted,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Text style={{ color: tokens.foreground, fontSize: 9 }}>@</Text>
      </View>
    );
  }
  return (
    <View
      style={{
        width: 16,
        height: 16,
        borderRadius: 4,
        backgroundColor: mention.color ?? tokens.mutedForeground,
      }}
    />
  );
}

function MentionChipIcon({ mention }: { mention: ComposerMention }) {
  const tokens = useMobileTokens();
  if (mention.kind === "routine") {
    return (
      <NativeSymbol ios="clock" android="time-outline" size={13} color={tokens.mutedForeground} />
    );
  }
  if (mention.kind === "connector") {
    return (
      <NativeSymbol
        ios="puzzlepiece.extension"
        android="extension-puzzle-outline"
        size={13}
        color={tokens.mutedForeground}
      />
    );
  }
  if (mention.kind === "group" || mention.kind === "everyone") {
    return (
      <View
        style={{
          width: 14,
          height: 14,
          borderRadius: 7,
          backgroundColor: tokens.muted,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Text style={{ color: tokens.foreground, fontSize: 9 }}>
          {mention.kind === "group" ? "G" : "@"}
        </Text>
      </View>
    );
  }
  return (
    <View
      style={{
        width: 14,
        height: 14,
        borderRadius: 4,
        backgroundColor: mention.color ?? tokens.mutedForeground,
      }}
    />
  );
}
