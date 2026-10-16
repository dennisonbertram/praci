import type { SpaceBot, SpaceGroup } from "@rakazo/contracts";
import { ACTIVE_RUN_STATUSES } from "@rakazo/core";
import { botColors } from "@rakazo/ui-tokens";
import { memo } from "react";
import type { MobileBot, MobileGroup } from "../lib/api";
import { mobileBotAvatarPresentation } from "../lib/bot-avatar";
import { useI18n } from "../lib/i18n";
import { botTag, formatThreadTime } from "../lib/inbox";
import { previewSnippet } from "../lib/preview";
import { BotAvatar } from "./bot-avatar";
import { ConversationRow } from "./conversation-row";
import { GroupAvatar } from "./group-avatar";
import { WorkingIndicator } from "./WorkingIndicator";

export const FALLBACK_COLOR = botColors[3];

export const BotRow = memo(function BotRow({
  bot,
  day,
  depth = 0,
  hasChildren = false,
  collapsed = false,
  onToggleChildren,
  onPress,
  onLongPress,
}: {
  bot: MobileBot | SpaceBot;
  day: number;
  depth?: number;
  hasChildren?: boolean;
  collapsed?: boolean;
  onToggleChildren?: (botId: string) => void;
  onPress: (bot: MobileBot | SpaceBot) => void;
  onLongPress?: (bot: MobileBot | SpaceBot) => void;
}) {
  const { t } = useI18n();
  const preview = previewSnippet(bot.preview, 40) || bot.title || t("No messages yet");
  const time = bot.updatedAt ? formatThreadTime(bot.updatedAt, new Date(day)) : "";
  const tag = botTag(bot.title, bot.name);
  const working = ACTIVE_RUN_STATUSES.some((status) => status === bot.status);
  // Only flat avatars carry a usable color; image avatars fall back to the muted dot.
  const presentation = mobileBotAvatarPresentation(bot.color || FALLBACK_COLOR);
  const tint =
    presentation.kind === "shape" || presentation.kind === "color" ? presentation.color : undefined;
  // Spelled out because an explicit label replaces the one built from the row's children.
  const label = [
    bot.name,
    tag,
    working ? t("Working…") : null,
    bot.notifyOnFinish === false ? t("notifications silenced") : null,
    bot.unread ? t("unread") : null,
    time,
    preview,
  ]
    .filter(Boolean)
    .join(", ");
  return (
    <ConversationRow
      title={bot.name}
      preview={preview}
      time={time}
      tag={tag}
      unread={bot.unread}
      depth={depth}
      hasChildren={hasChildren}
      collapsed={collapsed}
      onToggleChildren={onToggleChildren ? () => onToggleChildren(bot.id) : undefined}
      accessibilityLabel={label}
      accessibilityHint={
        onLongPress ? t("Long press to pin, move, or silence notifications") : undefined
      }
      onPress={() => onPress(bot)}
      onLongPress={onLongPress ? () => onLongPress(bot) : undefined}
      indicator={working ? <WorkingIndicator compact tint={tint} /> : null}
      avatar={
        <BotAvatar
          color={bot.color || FALLBACK_COLOR}
          identity={bot.id}
          status={bot.status}
          muted={bot.notifyOnFinish === false}
        />
      }
    />
  );
});

export const GroupRow = memo(function GroupRow({
  group,
  day,
  onPress,
  onLongPress,
}: {
  group: MobileGroup | SpaceGroup;
  day: number;
  onPress: (group: MobileGroup | SpaceGroup) => void;
  onLongPress?: (group: MobileGroup | SpaceGroup) => void;
}) {
  const { t } = useI18n();
  const preview =
    previewSnippet(group.preview, 40) || group.members.map((member) => member.name).join(", ");
  const time = group.updatedAt ? formatThreadTime(group.updatedAt, new Date(day)) : "";
  return (
    <ConversationRow
      title={group.name}
      preview={preview}
      time={time}
      unread={group.unread}
      accessibilityLabel={[group.name, group.unread ? t("unread") : null, time, preview]
        .filter(Boolean)
        .join(", ")}
      accessibilityHint={onLongPress ? t("Long press to pin or move to a section") : undefined}
      onPress={() => onPress(group)}
      onLongPress={onLongPress ? () => onLongPress(group) : undefined}
      avatar={<GroupAvatar members={group.members} size={54} />}
    />
  );
});
