import { MenuView } from "@expo/ui/community/menu";
import type { ReactNode } from "react";
import { useI18n } from "../lib/i18n";
import { useResolvedAppearance } from "../lib/native";

/** Long press on a mail row opens the system menu with Archive. */
export function MailRowMenu({
  onArchive,
  children,
}: {
  onArchive: () => void;
  children: ReactNode;
}) {
  const { t } = useI18n();
  return (
    <MenuView
      shouldOpenOnLongPress
      colorScheme={useResolvedAppearance()}
      actions={[{ id: "archive", title: t("Archive"), image: "archivebox" }]}
      onPressAction={onArchive}
    >
      {children}
    </MenuView>
  );
}
