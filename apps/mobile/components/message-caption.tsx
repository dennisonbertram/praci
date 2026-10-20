import { ChatMarkdown, LinkifiedText } from "@rakazo/chat-ui/native";
import { splitDataRoomReferences } from "@rakazo/core";
import type { ColorTokens, ResolvedAppearance } from "@rakazo/ui-tokens";
import { Text, View } from "react-native";
import type { MobileMessage } from "../lib/api";

export function MessageCaption({
  role,
  text,
  tokens,
  colorScheme,
  streaming,
}: {
  role: MobileMessage["role"];
  text: string;
  tokens: ColorTokens;
  colorScheme: ResolvedAppearance;
  streaming: boolean;
}) {
  // User messages keep literal Markdown; only explicit URLs and email addresses link. Data room
  // files the server appended show by name (the app has no Data room screen to open them in).
  if (role !== "user") {
    return (
      <ChatMarkdown palette={tokens} colorScheme={colorScheme} streaming={streaming}>
        {text}
      </ChatMarkdown>
    );
  }
  const { body, refs } = splitDataRoomReferences(text);
  return (
    <View style={{ gap: 6 }}>
      {body ? (
        <LinkifiedText color={tokens.secondaryForeground} linkColor={tokens.link} palette={tokens}>
          {body}
        </LinkifiedText>
      ) : null}
      {refs.map((ref) => (
        <Text
          key={ref.id}
          numberOfLines={1}
          style={{ color: tokens.secondaryForeground, fontSize: 13, fontWeight: "500" }}
        >
          {ref.name}
        </Text>
      ))}
    </View>
  );
}
