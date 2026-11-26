import { t as coreT } from "@lingui/core/macro";
import { useLingui as useReactLingui } from "@lingui/react";
import type { ReactNode } from "react";

type MessageDescriptor = { id?: string; message?: string } & Record<string, unknown>;

function renderMessage(descriptor: MessageDescriptor): string {
  const message = descriptor.message ?? descriptor.id ?? "";
  const values = descriptor.values as Record<string, unknown> | undefined;
  return message.replace(/\{([^}]+)\}/g, (_, name: string) =>
    String(values?.[name] ?? descriptor[name] ?? `{${name}}`),
  );
}

export function useLingui() {
  const { i18n: activeI18n } = useReactLingui();
  const i18n = {
    get locale(): string {
      return activeI18n.locale || "en";
    },
    _(descriptor: MessageDescriptor): string {
      return renderMessage(descriptor);
    },
  };
  return { t: coreT, i18n, _: i18n._ };
}

export function Trans({ children }: { children?: ReactNode }): ReactNode {
  return children;
}

export function Plural({
  value,
  one,
  other,
}: {
  value: number;
  one: ReactNode;
  other: ReactNode;
}): ReactNode {
  const form = value === 1 ? one : other;
  return typeof form === "string" ? form.replace(/#/g, String(value)) : form;
}

export function Select({
  value,
  other,
  ...forms
}: {
  value: string;
  other: ReactNode;
  [form: string]: ReactNode;
}): ReactNode {
  return forms[value] ?? other;
}
