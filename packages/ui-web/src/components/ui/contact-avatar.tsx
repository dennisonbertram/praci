import { cn } from "@rakazo/ui-web/lib/utils";
import { Avatar, AvatarFallback, AvatarImage } from "./avatar";
import { Tooltip, TooltipContent, TooltipTrigger } from "./tooltip";

/** A person or organization. `src` is a photo URL when one is known; otherwise initials show. */
export interface ContactAvatarPerson {
  name: string;
  src?: string | null;
}

const SUFFIX = /[\s,]+(inc|llc|ltd|corp|corporation|co|company|gmbh)\.?$/i;

/** Up to two initials; a trailing company suffix such as "Inc." and anything in parentheses do not count. */
export function initials(name: string): string {
  const words = name
    .replace(/\([^)]*\)/g, " ")
    .trim()
    .replace(SUFFIX, "")
    .split(/\s+/)
    .filter(Boolean);
  const picks = words.length > 1 ? [words[0], words[words.length - 1]] : words;
  return picks
    .map((word) => Array.from(word as string)[0] ?? "")
    .join("")
    .toUpperCase();
}

/**
 * One person or organization: the photo at `src`, else initials on the muted token background.
 * `size` is "sm" (24px), "default" (32px) or "lg" (40px).
 */
export function ContactAvatar({
  name,
  src,
  size = "default",
  className,
}: ContactAvatarPerson & { size?: "sm" | "default" | "lg"; className?: string }) {
  return (
    <Avatar size={size} className={className} aria-label={name}>
      {src ? <AvatarImage src={src} alt="" referrerPolicy="no-referrer" /> : null}
      <AvatarFallback className={size === "sm" ? "text-[10px]" : "text-xs"}>
        {initials(name)}
      </AvatarFallback>
    </Avatar>
  );
}

/**
 * Overlapping avatars, at most `max` (default 3) and then "+N". Hover or keyboard focus lists every
 * name in a tooltip. Renders nothing for an empty list.
 */
export function ContactAvatarGroup({
  people,
  max = 3,
  size = "default",
  className,
}: {
  people: ContactAvatarPerson[];
  max?: number;
  size?: "sm" | "default" | "lg";
  className?: string;
}) {
  if (people.length === 0) return null;
  const shown = people.slice(0, max);
  const extra = people.length - shown.length;
  const names = people.map((person) => person.name).join(", ");
  return (
    <Tooltip>
      <TooltipTrigger
        render={<span role="img" aria-label={names} className="inline-flex rounded-full" />}
        className={cn("-space-x-1", className)}
      >
        {shown.map((person) => (
          <ContactAvatar
            key={person.name}
            {...person}
            size={size}
            className="ring-2 ring-background"
          />
        ))}
        {extra > 0 ? (
          <span
            aria-hidden="true"
            className={cn(
              "relative flex shrink-0 items-center justify-center rounded-full bg-muted text-[10px] text-muted-foreground ring-2 ring-background",
              size === "sm" ? "size-6" : size === "lg" ? "size-10" : "size-8",
            )}
          >
            +{extra}
          </span>
        ) : null}
      </TooltipTrigger>
      <TooltipContent>
        <ul>
          {people.map((person) => (
            <li key={person.name}>{person.name}</li>
          ))}
        </ul>
      </TooltipContent>
    </Tooltip>
  );
}
