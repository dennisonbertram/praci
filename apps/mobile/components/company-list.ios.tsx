import { Button, Host, HStack, List, Spacer, SwipeActions, Text, VStack } from "@expo/ui/swift-ui";
import {
  buttonStyle,
  disabled,
  font,
  foregroundStyle,
  listStyle,
} from "@expo/ui/swift-ui/modifiers";
import { useI18n } from "../lib/i18n";
import { useMobileTokens, useResolvedAppearance } from "../lib/native";
import type { CompanyListProps } from "./company-list";

export function CompanyList({ rows, pending = false, empty }: CompanyListProps) {
  const { t } = useI18n();
  const tokens = useMobileTokens();
  return (
    <Host style={{ flex: 1 }} colorScheme={useResolvedAppearance()}>
      <List modifiers={[listStyle("insetGrouped")]}>
        {rows.length === 0 ? <Text>{empty ?? ""}</Text> : null}
        <List.ForEach>
          {rows.map((row) => {
            const content = (
              <VStack key={row.id} alignment="leading" spacing={4}>
                <Text modifiers={[foregroundStyle(tokens.foreground)]}>{row.title}</Text>
                {row.detail ? (
                  <Text modifiers={[font({ size: 14 }), foregroundStyle(tokens.mutedForeground)]}>
                    {row.detail}
                  </Text>
                ) : null}
              </VStack>
            );
            const body = row.onPress ? (
              <Button
                key={row.id}
                onPress={row.onPress}
                modifiers={[buttonStyle("plain"), disabled(pending)]}
              >
                <HStack>
                  {content}
                  <Spacer />
                </HStack>
              </Button>
            ) : (
              content
            );
            return row.onConfirm || row.onReject ? (
              <SwipeActions key={row.id} modifiers={[disabled(pending)]}>
                {body}
                <SwipeActions.Actions allowsFullSwipe={false}>
                  {row.onConfirm ? (
                    <Button label={t("Confirm")} systemImage="checkmark" onPress={row.onConfirm} />
                  ) : null}
                  {row.onReject ? (
                    <>
                      {/* biome-ignore lint/a11y/useValidAriaRole: SwiftUI Button role, not an ARIA role. */}
                      <Button
                        label={t("Reject")}
                        systemImage="xmark"
                        role="destructive"
                        onPress={row.onReject}
                      />
                    </>
                  ) : null}
                </SwipeActions.Actions>
              </SwipeActions>
            ) : (
              <VStack key={row.id} alignment="leading">
                {body}
              </VStack>
            );
          })}
        </List.ForEach>
      </List>
    </Host>
  );
}
