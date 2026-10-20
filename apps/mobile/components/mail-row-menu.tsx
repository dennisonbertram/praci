import { MenuView } from "@expo/ui/community/menu";
import type { ReactNode } from "react";
import { useI18n } from "../lib/i18n";
import { useResolvedAppearance } from "../lib/native";

/**
 * Long press on a mail row opens the system menu: Archive, then Spam and Trash when the list can
 * report them. A row in the Spam pile offers Not spam in place of Spam.
 */
export function MailRowMenu({
  onArchive,
  onSpam,
  onNotSpam,
  onTrash,
  children,
}: {
  onArchive: () => void;
  onSpam?: () => void;
  /** Present for a row in the Spam pile. */
  onNotSpam?: () => void;
  onTrash?: () => void;
  children: ReactNode;
}) {
  const { t } = useI18n();
  const choices = [
    { id: "archive", title: t("Archive"), image: "archivebox" as const, run: onArchive },
    ...(onNotSpam
      ? [
          {
            id: "notSpam",
            title: t("Not spam"),
            image: "checkmark.shield" as const,
            run: onNotSpam,
          },
        ]
      : onSpam
        ? [{ id: "spam", title: t("Spam"), image: "xmark.shield" as const, run: onSpam }]
        : []),
    ...(onTrash ? [{ id: "trash", title: t("Trash"), image: "trash" as const, run: onTrash }] : []),
  ];
  return (
    <MenuView
      shouldOpenOnLongPress
      colorScheme={useResolvedAppearance()}
      actions={choices.map(({ id, title, image }) => ({ id, title, image }))}
      onPressAction={({ nativeEvent }) =>
        choices.find((choice) => choice.id === nativeEvent.event)?.run()
      }
    >
      {children}
    </MenuView>
  );
}
