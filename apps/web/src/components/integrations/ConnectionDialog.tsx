import { Trans } from "@lingui/react/macro";
import {
  Button,
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Input,
} from "@rakazo/ui-web";
import type { FormEvent, ReactNode } from "react";
import { useState } from "react";
import { errorText } from "../../lib/user-error";
import { AppLogo } from "./AppLogo";

export type ConnectionField = {
  id: string;
  label: string;
  type?: "text" | "password";
  /** A small link under the field, such as where to get a key. */
  help?: { href: string; label: ReactNode };
};

/** A small modal that asks for what a connection needs and shows the server's error inline. */
export function ConnectionDialog({
  title,
  name,
  logo,
  fields,
  submitLabel,
  onSubmit,
  onClose,
}: {
  title: ReactNode;
  name: string;
  logo: string | null;
  fields: ConnectionField[];
  submitLabel: ReactNode;
  onSubmit: (values: Record<string, string>) => Promise<void>;
  onClose: () => void;
}) {
  const [values, setValues] = useState<Record<string, string>>({});
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      await onSubmit(Object.fromEntries(fields.map((f) => [f.id, (values[f.id] ?? "").trim()])));
      onClose();
    } catch (cause) {
      setError(errorText(cause));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <form onSubmit={submit} className="flex flex-col gap-3">
          <DialogHeader>
            <div className="flex items-center gap-3">
              <AppLogo name={name} logo={logo} />
              <DialogTitle>{title}</DialogTitle>
            </div>
          </DialogHeader>
          {fields.map((field, index) => (
            <div key={field.id} className="flex flex-col gap-1">
              <Input
                autoFocus={index === 0}
                required
                type={field.type ?? "text"}
                autoComplete="off"
                spellCheck={false}
                aria-label={field.label}
                placeholder={field.label}
                value={values[field.id] ?? ""}
                onChange={(e) => setValues((prev) => ({ ...prev, [field.id]: e.target.value }))}
              />
              {field.help ? (
                <a
                  href={field.help.href}
                  target="_blank"
                  rel="noreferrer"
                  className="text-xs text-muted-foreground hover:text-foreground hover:underline"
                >
                  {field.help.label}
                </a>
              ) : null}
            </div>
          ))}
          {error ? (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          ) : null}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              <Trans>Cancel</Trans>
            </Button>
            <Button type="submit" disabled={busy}>
              {submitLabel}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
