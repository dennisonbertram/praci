import type { MessageDescriptor } from "@lingui/core";
import { msg, t } from "@lingui/core/macro";
import type { SpaceMemoryConfig } from "@rakazo/contracts";
import type { ComponentType } from "react";
import { SerenitySettingsForm } from "./SerenitySettingsForm";
import { SupermemorySettingsForm } from "./SupermemorySettingsForm";

export interface MemoryProviderConnectionDraft {
  settings: Record<string, string>;
  credentials: Record<string, string>;
}

export interface MemoryProviderSettingsFormProps {
  busy: boolean;
  onConnect: (draft: MemoryProviderConnectionDraft) => Promise<boolean>;
}

export interface MemoryProviderSettingsRegistration {
  id: string;
  name: string;
  description: MessageDescriptor;
  SettingsForm: ComponentType<MemoryProviderSettingsFormProps>;
  connectedLabel: (config: SpaceMemoryConfig) => string;
}

export const MEMORY_PROVIDER_SETTINGS: readonly MemoryProviderSettingsRegistration[] = [
  {
    id: "supermemory",
    name: "Supermemory",
    description: msg`Lets bots search everything they have learned, on top of built-in memory.`,
    SettingsForm: SupermemorySettingsForm,
    connectedLabel: (config) =>
      config.settings.mode === "cloud"
        ? "Supermemory Cloud"
        : t`Local · ${config.settings.baseUrl ?? ""}`,
  },
  {
    id: "serenity",
    name: "Serenity",
    description: msg`Keeps bot memory in Serenity, hosted for you or on your own server.`,
    SettingsForm: SerenitySettingsForm,
    connectedLabel: (config) => {
      const label = config.settings.brainLabel?.trim();
      const endpoint = config.settings.endpoint ?? "Serenity";
      const mode = config.settings.allowWrites === "true" ? t`read/write` : t`recall only`;
      return label ? t`Serenity · ${label} · ${mode}` : t`Serenity · ${endpoint} · ${mode}`;
    },
  },
];

export function memoryProviderSettings(provider: string) {
  return MEMORY_PROVIDER_SETTINGS.find((entry) => entry.id === provider) ?? null;
}

export function defaultMemoryProviderSettings(): MemoryProviderSettingsRegistration {
  const registration = MEMORY_PROVIDER_SETTINGS[0];
  if (!registration) throw new Error("No memory provider settings are registered.");
  return registration;
}
