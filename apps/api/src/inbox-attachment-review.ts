import { attachmentReviewContext, extractAttachmentText } from "@rakazo/adapters";
import type {
  Actor,
  InboxAttachmentReviewInput,
  InboxAttachmentReviewOutput,
} from "@rakazo/contracts";
import type { InboxDeps } from "./inbox.js";
import { formatAddress, inboxAttachment, mailContext, ownMessage } from "./inbox.js";
import type { RouterDeps } from "./routes/context.js";

/**
 * A disposable AI review of one attachment. The message and attachment are fetched through the same
 * actor-scoped path as a download (another user's, or one that is not on the message, is not
 * found); the file's text goes to the model only after the consent check inside `reviewAttachment`,
 * and the model has no tools. Nothing is stored: the browser sends the chat back with each question.
 * ponytail: a follow-up fetches and reads the file again; cache the text per message if that is slow.
 */
export async function inboxReviewAttachment(
  deps: InboxDeps & Pick<RouterDeps, "reviewAttachment">,
  actor: Actor,
  input: InboxAttachmentReviewInput,
  signal?: AbortSignal,
): Promise<InboxAttachmentReviewOutput> {
  if (!deps.reviewAttachment) return { status: "unavailable" };
  const context = mailContext(actor, "inbox.reviewAttachment", signal);
  const { row } = await ownMessage(deps, actor, input.messageId, context);
  const file = await inboxAttachment(
    deps,
    actor,
    { messageId: input.messageId, attachmentId: input.attachmentId },
    signal,
  );
  const text = await extractAttachmentText(
    file.bytes,
    { mimeType: file.mimeType, name: file.filename },
    context,
  ).catch(() => "");
  return deps.reviewAttachment(
    {
      scope: { userId: actor.userId, spaceId: actor.spaceId },
      context: attachmentReviewContext({
        email: {
          from: formatAddress({ name: row.fromName ?? undefined, address: row.fromAddress }),
          subject: row.subject,
          category: row.category,
          snippet: row.snippet,
        },
        file: { name: file.filename, mimeType: file.mimeType, size: file.bytes.length },
        text,
      }),
      question: input.question,
      history: input.history ?? [],
    },
    signal,
  );
}
