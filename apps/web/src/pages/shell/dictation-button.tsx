import { useLingui } from "@lingui/react/macro";
import { Button } from "@rakazo/ui-web";
import { LoaderCircle, Mic, Square } from "lucide-react";
import type { DictationStatus } from "../../lib/dictation";

/** Composer mic: tap to listen, tap again to stop and transcribe. */
export function DictationButton({
  status,
  disabled,
  onClick,
}: {
  status: DictationStatus;
  disabled?: boolean;
  onClick: () => void;
}) {
  const { t } = useLingui();
  const label =
    status === "listening"
      ? t`Stop dictation`
      : status === "transcribing"
        ? t`Transcribing…`
        : t`Dictate`;
  return (
    <Button
      variant="outline"
      size="icon"
      aria-label={label}
      title={label}
      disabled={disabled}
      onClick={onClick}
      className="size-8 shrink-0 rounded-full text-foreground/75"
    >
      {status === "listening" ? (
        <Square
          size={11}
          strokeWidth={0}
          fill="currentColor"
          className="animate-pulse text-destructive motion-reduce:animate-none"
        />
      ) : status === "transcribing" ? (
        <LoaderCircle
          size={16}
          strokeWidth={1.8}
          className="animate-spin motion-reduce:animate-none"
        />
      ) : (
        <Mic size={16} strokeWidth={1.8} />
      )}
    </Button>
  );
}

export function DictationError({ message }: { message: string }) {
  return (
    <p role="status" className="mb-3 text-[13px] text-destructive">
      {message}
    </p>
  );
}
