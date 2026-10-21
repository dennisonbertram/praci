import { useLingui } from "@lingui/react/macro";
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Input,
  Tabs,
  TabsList,
  TabsTrigger,
  Textarea,
} from "@rakazo/ui-web";
import { useEffect, useState } from "react";

/**
 * Where an agent's secret request is answered. The value lives only in this component's state:
 * it is cleared on submit and whenever the dialog closes, and it is never rendered back.
 */
export function SecretRequestDialog({
  open,
  onOpenChange,
  name,
  description,
  login,
  onSubmit,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  name: string;
  description?: string;
  /** A website sign-in asks for a username as well as the password. */
  login?: boolean;
  onSubmit: (value: string, username?: string) => void;
}) {
  const { t } = useLingui();
  const [multiline, setMultiline] = useState(false);
  const [value, setValue] = useState("");
  const [username, setUsername] = useState("");

  useEffect(() => {
    if (open) return;
    setValue("");
    setUsername("");
    setMultiline(false);
  }, [open]);

  const ready = value.length > 0 && (!login || username.trim().length > 0);
  const multi = multiline && !login;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <form
          className="flex flex-col gap-4"
          onSubmit={(event) => {
            event.preventDefault();
            if (!ready) return;
            const submitted = value;
            const submittedUsername = login ? username.trim() : undefined;
            setValue("");
            setUsername("");
            onSubmit(submitted, submittedUsername);
          }}
        >
          <DialogHeader>
            <DialogTitle>{t`Provide secret`}</DialogTitle>
            {description ? <DialogDescription>{description}</DialogDescription> : null}
          </DialogHeader>
          {login ? null : (
            <Tabs
              value={multiline ? "multi" : "single"}
              onValueChange={(v) => setMultiline(v === "multi")}
            >
              <TabsList>
                <TabsTrigger value="single">{t`Single line`}</TabsTrigger>
                <TabsTrigger value="multi">{t`Multi line`}</TabsTrigger>
              </TabsList>
            </Tabs>
          )}
          {login ? (
            <Input
              aria-label={t`Username`}
              autoComplete="off"
              spellCheck={false}
              value={username}
              onChange={(event) => setUsername(event.target.value)}
              placeholder={t`Username`}
            />
          ) : null}
          {multi ? (
            <Textarea
              aria-label={name}
              autoComplete="off"
              spellCheck={false}
              rows={5}
              // ponytail: -webkit-text-security is not supported by Firefox, where a multi line value shows as plain text.
              className="font-mono [-webkit-text-security:disc]"
              value={value}
              onChange={(event) => setValue(event.target.value)}
              placeholder={name}
            />
          ) : (
            <Input
              aria-label={name}
              type="password"
              autoComplete="off"
              spellCheck={false}
              value={value}
              onChange={(event) => setValue(event.target.value)}
              placeholder={name}
            />
          )}
          <DialogFooter>
            <Button type="submit" disabled={!ready}>
              {t`Submit`}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
