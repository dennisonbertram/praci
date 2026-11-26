import { Shield } from "lucide-react";

/** Marks a bot whose Firewall is on; it reads the same as a halo beside the name. */
export function BotFirewallMark() {
  return (
    <Shield role="img" aria-label="Firewall on" className="size-4 shrink-0 text-muted-foreground" />
  );
}
