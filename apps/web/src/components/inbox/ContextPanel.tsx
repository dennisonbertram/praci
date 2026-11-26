import { t } from "@lingui/core/macro";
import { Trans } from "@lingui/react/macro";
import type { InboxPersonContext } from "@rakazo/contracts";
import { ContactAvatar, cn, Skeleton } from "@rakazo/ui-web";
import type { LucideIcon } from "lucide-react";
import { CalendarDays, ChevronDown, Circle, FileText, Mail } from "lucide-react";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { formatMailTime } from "../../lib/mail-time";
import { rpc } from "../../lib/rpc";
import { Shimmer } from "../ai/primitives";
import { contactKindNames } from "../ContactDialog";

export interface ContextPerson {
  email: string;
  name?: string;
}

const hasFacts = (facts: InboxPersonContext) =>
  Boolean(
    facts.name ||
      facts.kind ||
      facts.threadCount ||
      facts.documents.length ||
      facts.todos.length ||
      facts.lastMeeting ||
      facts.nextMeeting,
  );

const rowClass =
  "-mx-2 flex items-center gap-2 rounded-md px-2 py-1 text-sm pointer-coarse:min-h-11 hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:outline-none";

function Section({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col">
      <h3 className="mb-1 text-xs font-medium text-muted-foreground">{label}</h3>
      {children}
    </section>
  );
}

function Item({
  icon: Icon,
  title,
  date,
  to,
  href,
}: {
  icon: LucideIcon;
  title: string;
  date?: string | null;
  to?: string;
  href?: string | null;
}) {
  const body = (
    <>
      <Icon aria-hidden="true" className="size-3.5 shrink-0 text-muted-foreground" />
      <span dir="auto" className="min-w-0 flex-1 truncate">
        {title}
      </span>
      {date ? (
        <span className="shrink-0 text-xs text-muted-foreground tabular-nums">
          {formatMailTime(date)}
        </span>
      ) : null}
    </>
  );
  if (to)
    return (
      <Link to={to} className={rowClass}>
        {body}
      </Link>
    );
  if (href)
    return (
      <a href={href} target="_blank" rel="noopener noreferrer" className={rowClass}>
        {body}
      </a>
    );
  return <div className={cn(rowClass, "hover:bg-transparent")}>{body}</div>;
}

const linkClass = "underline-offset-2 hover:underline focus-visible:underline";
/** The contact line is 16px tall; a touch gets a 44px target without moving the line. */
const tapLinkClass = `${linkClass} pointer-coarse:inline-block pointer-coarse:py-3.5 pointer-coarse:-my-3.5`;

/**
 * What the user already has about one address. The facts come first and carry no model; the
 * summary is asked for once they are in, and stays out when there is no model or consent.
 */
function PersonFacts({ email }: { email: string }) {
  const [facts, setFacts] = useState<InboxPersonContext | null | undefined>(undefined);
  const [summary, setSummary] = useState<string | null | undefined>(undefined);
  useEffect(() => {
    let current = true;
    setFacts(undefined);
    setSummary(undefined);
    (async () => {
      const loaded: InboxPersonContext | null = await Promise.resolve()
        .then(() => rpc.inbox.personContext({ email }))
        .catch(() => null);
      if (!current) return;
      setFacts(loaded);
      if (!loaded || !hasFacts(loaded)) return setSummary(null);
      const result = await Promise.resolve()
        .then(() => rpc.inbox.personSummary({ email }))
        .catch(() => null);
      if (current) setSummary(result?.status === "ok" ? result.summary : null);
    })();
    return () => {
      current = false;
    };
  }, [email]);

  if (facts === undefined)
    return (
      <div role="status" aria-busy="true" aria-label={t`Loading`} className="flex flex-col gap-2">
        <Skeleton className="h-3 w-2/3" />
        <Skeleton className="h-3 w-full" />
        <Skeleton className="h-3 w-5/6" />
      </div>
    );
  if (!facts || !hasFacts(facts))
    return (
      <p className="text-sm text-muted-foreground">
        <Trans>No context yet</Trans>
      </p>
    );
  const identity = [
    facts.organization,
    facts.kind && ((contactKindNames() as Record<string, string>)[facts.kind] ?? facts.kind),
  ]
    .filter(Boolean)
    .join(" · ");
  const meeting = (m: NonNullable<InboxPersonContext["lastMeeting"]>) => (
    <Item icon={CalendarDays} title={m.title} date={m.start} href={m.href} />
  );
  return (
    <div className="flex flex-col gap-4">
      {identity || facts.lastEmailedAt ? (
        <p className="text-xs text-muted-foreground">
          {identity ? (
            facts.contactId ? (
              <Link to={`/app/contacts/${facts.contactId}`} dir="auto" className={tapLinkClass}>
                {identity}
              </Link>
            ) : (
              <span dir="auto">{identity}</span>
            )
          ) : null}
          {identity && facts.lastEmailedAt ? " · " : null}
          {facts.lastEmailedAt ? (
            <span>
              <Trans>Last emailed</Trans> {formatMailTime(facts.lastEmailedAt)}
            </span>
          ) : null}
        </p>
      ) : null}
      {summary === undefined || summary ? (
        <div className="rounded-lg bg-muted/50 p-3 text-sm leading-relaxed">
          {summary === undefined ? (
            <p role="status">
              <Shimmer>
                <Trans>Summarizing</Trans>
              </Shimmer>
            </p>
          ) : (
            <p dir="auto">{summary}</p>
          )}
        </div>
      ) : null}
      {facts.threads.length ? (
        <Section label={t`Threads`}>
          {facts.threads.map((thread) => (
            <Item
              key={thread.id}
              icon={Mail}
              title={thread.subject}
              date={thread.receivedAt}
              to={`/app/inbox?mail=${encodeURIComponent(thread.id)}`}
            />
          ))}
        </Section>
      ) : null}
      {facts.lastMeeting ? (
        <Section label={t`Last meeting`}>{meeting(facts.lastMeeting)}</Section>
      ) : null}
      {facts.nextMeeting ? (
        <Section label={t`Next meeting`}>{meeting(facts.nextMeeting)}</Section>
      ) : null}
      {facts.documents.length ? (
        <Section label={t`Documents`}>
          {facts.documents.map((doc) => (
            <Item
              key={doc.id}
              icon={FileText}
              title={doc.name}
              to={`/app/data-room?item=${encodeURIComponent(doc.id)}`}
            />
          ))}
        </Section>
      ) : null}
      {facts.todos.length ? (
        <Section label={t`To-dos`}>
          {facts.todos.map((todo) => (
            <Item key={todo.id} icon={Circle} title={todo.text} date={todo.dueOn} />
          ))}
        </Section>
      ) : null}
    </div>
  );
}

/** One section per person, the first one open; each loads only when it is open. */
export function ContextPanel({ people }: { people: ContextPerson[] }) {
  const [open, setOpen] = useState<Record<string, boolean>>({});
  if (!people.length)
    return (
      <p className="px-4 py-3 text-sm text-muted-foreground">
        <Trans>No context yet</Trans>
      </p>
    );
  return (
    <div className="flex flex-col divide-y divide-border">
      {people.map((person, index) => {
        const expanded = open[person.email] ?? index === 0;
        return (
          <section key={person.email} className="px-4 py-3">
            <button
              type="button"
              aria-expanded={expanded}
              onClick={() => setOpen({ ...open, [person.email]: !expanded })}
              className="flex w-full items-center gap-3 rounded-md text-start focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:outline-none"
            >
              <ContactAvatar name={person.name || person.email} />
              <span className="min-w-0 flex-1">
                <span dir="auto" className="block truncate text-sm font-medium">
                  {person.name || person.email}
                </span>
                {person.name ? (
                  <span dir="auto" className="block truncate text-xs text-muted-foreground">
                    {person.email}
                  </span>
                ) : null}
              </span>
              <ChevronDown
                aria-hidden="true"
                className={cn("size-4 shrink-0 text-muted-foreground", expanded && "rotate-180")}
              />
            </button>
            {expanded ? (
              <div className="mt-3">
                <PersonFacts email={person.email} />
              </div>
            ) : null}
          </section>
        );
      })}
    </div>
  );
}
