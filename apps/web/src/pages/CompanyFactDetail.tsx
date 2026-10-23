import { t } from "@lingui/core/macro";
import { Trans } from "@lingui/react/macro";
import type { CompanyFact, CompanyPartialDate } from "@rakazo/contracts";
import {
  CompanyEdgeEditInputSchema,
  CompanyEntityEditInputSchema,
  CompanyEventEditInputSchema,
} from "@rakazo/contracts";
import { Badge, Button, Dialog, DialogContent, DialogTitle, Input, Textarea } from "@rakazo/ui-web";
import { useId, useRef, useState } from "react";
import { companyDate, companyFactTitle } from "../lib/company-format";
import { maskCurrencyWhenHidden, useHideAmounts } from "../lib/hide-amounts-preference";
import { rpc } from "../lib/rpc";
import { errorText } from "../lib/user-error";

export function CompanyFactDetail({
  fact,
  onClose,
  onChanged,
}: {
  fact: CompanyFact;
  onClose: () => void;
  onChanged: () => void;
}) {
  const id = useId();
  const popupRef = useRef<HTMLDivElement>(null);
  const hidden = useHideAmounts();
  const [editing, setEditing] = useState(false);
  const initialName = fact.kind === "edge" ? (fact.record.role ?? "") : companyFactTitle(fact);
  const [name, setName] = useState(initialName);
  const [description, setDescription] = useState(
    fact.kind === "entity" ? String(fact.record.attrs.description ?? "") : "",
  );
  const [whatWeDo, setWhatWeDo] = useState(
    fact.kind === "entity" ? String(fact.record.attrs.whatWeDo ?? "") : "",
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const ref = { kind: fact.kind, id: fact.record.id };
  async function act(operation: () => Promise<unknown>) {
    setBusy(true);
    setError("");
    try {
      await operation();
      onChanged();
    } catch (cause) {
      setError(errorText(cause));
    } finally {
      setBusy(false);
    }
  }
  async function save() {
    if (fact.kind === "entity") {
      const attrs: Record<string, string> = {};
      if (description !== String(fact.record.attrs.description ?? ""))
        attrs.description = description;
      if (whatWeDo !== String(fact.record.attrs.whatWeDo ?? "")) attrs.whatWeDo = whatWeDo;
      if (name.trim() === initialName && Object.keys(attrs).length === 0) return;
      await rpc.company.editEntity(
        CompanyEntityEditInputSchema.parse({
          entityId: fact.record.id,
          kind: fact.record.kind,
          ...(name !== fact.record.displayName ? { displayName: name } : {}),
          ...(Object.keys(attrs).length ? { attrs } : {}),
        }),
      );
    } else if (fact.kind === "edge") {
      if (name.trim() === initialName) return;
      await rpc.company.editEdge(
        CompanyEdgeEditInputSchema.parse({ edgeId: fact.record.id, role: name.trim() || null }),
      );
    } else {
      if (name.trim() === initialName) return;
      await rpc.company.editEvent(
        CompanyEventEditInputSchema.parse({ eventId: fact.record.id, title: name }),
      );
    }
  }
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open && !busy) onClose();
      }}
    >
      <DialogContent
        ref={popupRef}
        initialFocus={popupRef}
        tabIndex={-1}
        className="inset-y-0 left-auto right-0 h-full max-h-screen w-full translate-x-0 translate-y-0 content-start overflow-y-auto rounded-none sm:max-w-lg"
      >
        <DialogTitle className="pr-8">{maskCurrencyWhenHidden(companyFactTitle(fact))}</DialogTitle>
        <div className="flex items-center gap-2">
          <Badge variant="secondary">
            {fact.record.status === "confirmed" ? t`Confirmed` : t`Not confirmed`}
          </Badge>
          <span className="text-muted-foreground">{Math.round(fact.record.confidence * 100)}%</span>
        </div>
        {fact.record.evidence.some((e) => e.stance === "contradicts") && (
          <p className="text-warning">
            <Trans>Conflicting evidence</Trans>
          </p>
        )}
        {fact.record.lockedFields.length > 0 && (
          <p className="text-xs text-muted-foreground">
            <Trans>Locked fields</Trans>: {fact.record.lockedFields.join(", ")}
          </p>
        )}
        {fact.kind === "entity" && (
          <dl className="space-y-2">
            {Object.entries(fact.record.attrs).map(([key, value]) => (
              <div key={key}>
                <dt className="text-muted-foreground capitalize">
                  {key.replace(/([a-z])([A-Z])/g, "$1 $2")}
                </dt>
                <dd>
                  {maskCurrencyWhenHidden(
                    Array.isArray(value)
                      ? value.join(", ")
                      : typeof value === "object" && value !== null
                        ? "date" in value && "precision" in value
                          ? companyDate(value as CompanyPartialDate)
                          : JSON.stringify(value)
                        : String(value),
                  )}
                </dd>
              </div>
            ))}
          </dl>
        )}
        {fact.kind === "entity" &&
          fact.record.kind === "person" &&
          fact.record.edges.length > 0 && (
            <section className="space-y-2">
              <h3 className="font-medium">
                <Trans>Roles over time</Trans>
              </h3>
              {fact.record.edges.map((edge) => (
                <p key={edge.id}>
                  {maskCurrencyWhenHidden(edge.role ?? edge.relation.replaceAll("_", " "))} ·{" "}
                  {companyDate(edge.startsOn)} — {companyDate(edge.endsOn)}
                </p>
              ))}
            </section>
          )}
        {fact.kind === "edge" && (
          <p>
            {companyDate(fact.record.startsOn)} — {companyDate(fact.record.endsOn)}
          </p>
        )}
        {fact.kind === "event" && (
          <p>
            {companyDate(fact.record.occursOn)}
            {fact.record.endsOn && ` — ${companyDate(fact.record.endsOn)}`}
            {fact.record.amountCents != null && (
              <span className="ms-3">
                {hidden
                  ? "•••"
                  : `${fact.record.currency} ${(fact.record.amountCents / 100).toLocaleString()}`}
              </span>
            )}
          </p>
        )}
        {editing && !hidden ? (
          <form
            className="space-y-4"
            onSubmit={(event) => {
              event.preventDefault();
              void act(save);
            }}
          >
            <label htmlFor={`${id}-name`} className="block space-y-1">
              <span>{fact.kind === "edge" ? t`Role` : t`Name`}</span>
              <Input
                id={`${id}-name`}
                value={name}
                onChange={(e) => setName(e.target.value)}
                maxLength={200}
                required={fact.kind !== "edge"}
              />
            </label>
            {fact.kind === "entity" &&
              ["company", "matter", "product"].includes(fact.record.kind) && (
                <label htmlFor={`${id}-description`} className="block space-y-1">
                  <span>
                    <Trans>Description</Trans>
                  </span>
                  <Textarea
                    id={`${id}-description`}
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    maxLength={500}
                  />
                </label>
              )}
            {fact.kind === "entity" && fact.record.kind === "company" && (
              <label htmlFor={`${id}-what-we-do`} className="block space-y-1">
                <span>
                  <Trans>What we do</Trans>
                </span>
                <Textarea
                  id={`${id}-what-we-do`}
                  value={whatWeDo}
                  onChange={(e) => setWhatWeDo(e.target.value)}
                  maxLength={2000}
                />
              </label>
            )}
            <Button type="submit" disabled={busy}>
              <Trans>Save</Trans>
            </Button>
            <Button type="button" variant="ghost" onClick={() => setEditing(false)}>
              <Trans>Cancel</Trans>
            </Button>
          </form>
        ) : (
          <div className="flex gap-2">
            <Button
              disabled={busy || fact.record.status === "confirmed"}
              onClick={() => void act(() => rpc.company.confirm(ref))}
            >
              <Trans>Confirm</Trans>
            </Button>
            <Button variant="outline" disabled={busy || hidden} onClick={() => setEditing(true)}>
              <Trans>Edit</Trans>
            </Button>
            <Button
              variant="destructive"
              disabled={busy}
              onClick={() => void act(() => rpc.company.reject(ref))}
            >
              <Trans>Reject</Trans>
            </Button>
          </div>
        )}
        {error && (
          <p role="alert" className="text-destructive">
            {error}
          </p>
        )}
        <section className="space-y-4">
          <h3 className="font-medium">
            <Trans>Sources</Trans>
          </h3>
          {fact.record.evidence.map((e) => (
            <div className="space-y-2 border-t pt-3" key={e.id}>
              <div className="flex justify-between">
                <span>{e.sourceKind.replaceAll("_", " ")}</span>
                {e.stance === "contradicts" && (
                  <Badge variant="outline">
                    <Trans>Conflicting evidence</Trans>
                  </Badge>
                )}
              </div>
              <blockquote className="border-l-2 pl-3">{maskCurrencyWhenHidden(e.quote)}</blockquote>
              <p className="text-xs text-muted-foreground">
                {e.extractedAt.slice(0, 10)}
                {e.extractorModel
                  ? ` · ${String(e.extractorModel.provider)} / ${String(e.extractorModel.model)}`
                  : ""}
              </p>
              {e.sourceUrl && (
                <a className="underline" href={e.sourceUrl} target="_blank" rel="noreferrer">
                  <Trans>Open source</Trans>
                </a>
              )}
            </div>
          ))}
        </section>
      </DialogContent>
    </Dialog>
  );
}
