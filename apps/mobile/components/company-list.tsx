import { FlatList, Text, View } from "react-native";
import { useI18n } from "../lib/i18n";
import { native } from "../lib/native";
import { NativeActionButton } from "./native-action-button";
import { SettingsRow } from "./settings-group";

export type CompanyListRow = {
  id: string;
  title: string;
  detail?: string;
  onPress?: () => void;
  onConfirm?: () => void;
  onReject?: () => void;
};
export type CompanyListProps = { rows: CompanyListRow[]; pending?: boolean; empty?: string };

export function CompanyList({ rows, pending, empty }: CompanyListProps) {
  const { t } = useI18n();
  return (
    <FlatList
      style={{ flex: 1, backgroundColor: native.groupedPage }}
      contentInsetAdjustmentBehavior="automatic"
      data={rows}
      keyExtractor={(row) => row.id}
      ListEmptyComponent={
        <Text style={{ color: native.secondaryLabel, padding: 20 }}>{empty}</Text>
      }
      renderItem={({ item }) => (
        <View style={{ backgroundColor: native.groupedCell }}>
          <SettingsRow
            title={item.title}
            detail={item.detail}
            onPress={item.onPress}
            disabled={pending}
            chevron={item.onPress ? "right" : undefined}
          />
          {item.onConfirm || item.onReject ? (
            <View style={{ flexDirection: "row", gap: 12, padding: 12 }}>
              {item.onConfirm ? (
                <NativeActionButton
                  label={t("Confirm")}
                  onPress={item.onConfirm}
                  disabled={pending}
                  fill={false}
                />
              ) : null}
              {item.onReject ? (
                <NativeActionButton
                  label={t("Reject")}
                  onPress={item.onReject}
                  disabled={pending}
                  prominence="destructive"
                  fill={false}
                />
              ) : null}
            </View>
          ) : null}
        </View>
      )}
    />
  );
}
