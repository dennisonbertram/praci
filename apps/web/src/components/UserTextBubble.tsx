import { LinkifiedText } from "@rakazo/chat-ui/web";
import { splitDataRoomReferences } from "@rakazo/core";
import { DataRoomRefChips } from "./data-room/DataRoomRefChips";

/**
 * A sent message: literal text, where only explicit URLs and email addresses are links, so a sent
 * address is tappable without formatting bold or headings. Data room files the server appended
 * to the text show as chips, never as raw lines.
 */
export function UserTextBubble({
  text,
  quoteMessageId,
}: {
  text: string;
  quoteMessageId?: string;
}) {
  const { body, refs } = splitDataRoomReferences(text);
  return (
    <div className="flex flex-col items-end gap-2">
      {body ? (
        <div className="flex w-fit max-w-full justify-end [@media(hover:none)]:w-full">
          <div
            data-testid="message-user-bubble"
            data-quote-message-id={quoteMessageId}
            className="max-w-full whitespace-pre-wrap wrap-anywhere rounded-[20px] bg-chat-user px-[18px] py-3 text-[15.5px] leading-[1.45] text-chat-user-foreground"
            dir="auto"
          >
            <LinkifiedText>{body}</LinkifiedText>
          </div>
        </div>
      ) : null}
      {refs.length ? <DataRoomRefChips refs={refs} /> : null}
    </div>
  );
}
