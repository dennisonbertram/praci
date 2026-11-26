import { t } from "@lingui/core/macro";
import { Button, Input } from "@rakazo/ui-web";
import { useState } from "react";
import { proposePortalProfile } from "../../lib/portal";

const FIELDS = [
  "firstName",
  "lastName",
  "contactEmail",
  "street",
  "city",
  "postalCode",
  "country",
] as const;
type Field = (typeof FIELDS)[number];

const label = (field: Field) =>
  ({
    firstName: t`First name`,
    lastName: t`Last name`,
    contactEmail: t`Email`,
    street: t`Street`,
    city: t`City`,
    postalCode: t`Postal code`,
    country: t`Country`,
  })[field];

/** The holder proposes new details; the company reviews them before anything changes. */
export function PortalProfile() {
  const [open, setOpen] = useState(false);
  const [values, setValues] = useState<Partial<Record<Field, string>>>({});
  const [state, setState] = useState<"idle" | "sending" | "sent" | "failed">("idle");

  if (state === "sent")
    return <p className="text-sm text-muted-foreground">{t`Sent to the company for review`}</p>;
  if (!open)
    return (
      <div>
        <Button variant="outline" className="min-h-11 md:min-h-8" onClick={() => setOpen(true)}>
          {t`Update your details`}
        </Button>
      </div>
    );

  const value = (field: Field) => values[field]?.trim() || undefined;
  const parts = ["street", "city", "postalCode", "country"] as const;
  const address = parts.every((f) => value(f));
  // An address replaces the whole stored one, so it is only sent complete, never with blanks.
  const partial = !address && parts.some((f) => value(f));
  const proposal = {
    ...(value("firstName") ? { firstName: value("firstName") } : {}),
    ...(value("lastName") ? { lastName: value("lastName") } : {}),
    ...(value("contactEmail") ? { contactEmail: value("contactEmail") } : {}),
    ...(address
      ? {
          address: {
            street: value("street")!,
            city: value("city")!,
            postalCode: value("postalCode")!,
            country: value("country")!,
          },
        }
      : {}),
  };
  const empty = Object.keys(proposal).length === 0;

  const send = async () => {
    setState("sending");
    try {
      await proposePortalProfile(proposal);
      setState("sent");
    } catch {
      setState("failed");
    }
  };

  return (
    <section aria-label={t`Your details`} className="flex flex-col gap-3">
      <h2 className="text-sm font-semibold">{t`Your details`}</h2>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        {FIELDS.map((field) => (
          <Input
            key={field}
            aria-label={label(field)}
            placeholder={label(field)}
            type={field === "contactEmail" ? "email" : "text"}
            value={values[field] ?? ""}
            onChange={(event) => setValues({ ...values, [field]: event.target.value })}
          />
        ))}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <Button
          className="min-h-11 md:min-h-8"
          disabled={empty || partial || state === "sending"}
          onClick={() => void send()}
        >
          {t`Send for review`}
        </Button>
        <Button variant="ghost" className="min-h-11 md:min-h-8" onClick={() => setOpen(false)}>
          {t`Cancel`}
        </Button>
        {state === "failed" ? (
          <p role="alert" className="text-sm text-destructive">
            {t`Could not send your details`}
          </p>
        ) : null}
      </div>
    </section>
  );
}
