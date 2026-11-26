import type { ThreadMessage } from "@rakazo/contracts";

export type RetryPayload = {
  text?: string;
  artifactIds?: string[];
};

export function retryPayload(message: Pick<ThreadMessage, "blocks">): RetryPayload | null {
  const text = message.blocks
    .flatMap((block) => (block.kind === "text" ? [block.text] : []))
    .join("\n");
  const artifactIds = message.blocks.flatMap((block) =>
    (block.kind === "file" || block.kind === "image") && block.artifactId ? [block.artifactId] : [],
  );
  if (!text.trim() && artifactIds.length === 0) return null;
  return {
    ...(text.trim() ? { text } : {}),
    ...(artifactIds.length ? { artifactIds } : {}),
  };
}
