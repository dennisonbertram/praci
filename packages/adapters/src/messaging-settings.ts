import { randomBytes } from "node:crypto";
import type { AdapterContext, SecretStore } from "@rakazo/adapter-kit";
import type {
  IMessageProviderId,
  MessagingSetupSave,
  MessagingSetupState,
} from "@rakazo/contracts";
import type { PrismaClient } from "@rakazo/db";
import { getLogger } from "@rakazo/logging";
import {
  BlueBubblesAdapter,
  type BlueBubblesAdapterConfig,
  BlueBubblesError,
  parseBlueBubblesServerUrl,
} from "./bluebubbles-adapter.js";
import type { MessagingEnvironmentValues } from "./messaging-platforms.js";
import { PhotonAdapter, type PhotonAdapterConfig, PhotonError } from "./photon-adapter.js";

type Field = { env: keyof MessagingEnvironmentValues; secret?: true };
/** Saved field name -> the env value it stands in for. Env wins per field. */
const FIELDS: Record<IMessageProviderId, Record<string, Field>> = {
  bluebubbles: {
    serverUrl: { env: "bluebubblesUrl" },
    password: { env: "bluebubblesPassword", secret: true },
    webhookToken: { env: "bluebubblesWebhookToken", secret: true },
  },
  photon: {
    projectId: { env: "photonProjectId" },
    projectSecret: { env: "photonProjectSecret", secret: true },
    webhookSecret: { env: "photonWebhookSecret", secret: true },
    address: { env: "photonImessageAddress" },
  },
};
const REQUIRED: Record<IMessageProviderId, string[]> = {
  bluebubbles: ["serverUrl", "password", "webhookToken"],
  photon: ["projectId", "projectSecret", "webhookSecret"],
};
const WEBHOOK_PATH = "/api/v1/messaging/webhook";

/**
 * iMessage credentials the deployment owner enters in the app. They live encrypted in
 * IntegrationProviderConfig (ids "bluebubbles" and "photon"); environment variables win per field.
 * The messaging surface is built once at boot, so a saved change takes effect on restart.
 */
export class MessagingSettings {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly secrets: SecretStore,
    private readonly options: {
      /** Environment values; they win over saved ones, field by field. */
      env: MessagingEnvironmentValues;
      /** Public API origin, for the webhook URLs shown to the owner. */
      apiUrl?: string;
      bluebubbles?: Partial<BlueBubblesAdapterConfig>;
      photon?: Partial<PhotonAdapterConfig>;
    },
  ) {}

  private async saved(id: IMessageProviderId): Promise<Record<string, string>> {
    const row = await this.prisma.integrationProviderConfig.findUnique({ where: { id } });
    if (!row) return {};
    const plaintext = await this.secrets.load(row.ciphertext, `integration-provider:${id}`);
    return JSON.parse(plaintext) as Record<string, string>;
  }

  /** The env values with saved values filling any field the environment leaves unset. */
  async withSaved(): Promise<MessagingEnvironmentValues> {
    const merged = { ...this.options.env };
    for (const id of Object.keys(FIELDS) as IMessageProviderId[]) {
      let saved: Record<string, string>;
      try {
        saved = await this.saved(id);
      } catch {
        // Never log the error: it can carry ciphertext context.
        getLogger().error(`Saved ${id} settings could not be read`);
        continue;
      }
      for (const [name, field] of Object.entries(FIELDS[id])) {
        if (!merged[field.env] && saved[name])
          (merged as Record<string, unknown>)[field.env] = saved[name];
      }
    }
    return merged;
  }

  async state(activeProviders: string[]): Promise<MessagingSetupState["providers"]> {
    const { env, apiUrl = "http://127.0.0.1:3100" } = this.options;
    const out: MessagingSetupState["providers"] = [];
    for (const id of Object.keys(FIELDS) as IMessageProviderId[]) {
      const saved = await this.saved(id).catch(() => ({}) as Record<string, string>);
      const fields: MessagingSetupState["providers"][number]["fields"] = {};
      const effective: Record<string, string> = {};
      for (const [name, field] of Object.entries(FIELDS[id])) {
        const fromEnv = env[field.env];
        const value = fromEnv || saved[name];
        if (value) effective[name] = value;
        fields[name] = {
          source: fromEnv ? "server" : saved[name] ? "saved" : "empty",
          ...(field.secret || !value ? {} : { value }),
        };
      }
      const token = effective.webhookToken;
      out.push({
        id,
        fields,
        configured: REQUIRED[id].every((name) => effective[name]),
        active: activeProviders.includes(id),
        // The owner needs the token to register BlueBubbles' webhook; it is shown only to them.
        webhookUrl:
          id === "photon"
            ? new URL(`${WEBHOOK_PATH}/photon`, apiUrl).toString()
            : token
              ? `${new URL(`${WEBHOOK_PATH}/bluebubbles`, apiUrl).toString()}?token=${encodeURIComponent(token)}`
              : null,
      });
    }
    return out;
  }

  async save(input: MessagingSetupSave, context: AdapterContext): Promise<void> {
    const saved = await this.saved(input.provider);
    let next: Record<string, string>;
    if (input.provider === "bluebubbles") {
      const serverUrl = parseBlueBubblesServerUrl(input.serverUrl).toString();
      const password = input.password || saved.password;
      if (!password) throw new Error("Enter the server password");
      const webhookToken =
        input.webhookToken || saved.webhookToken || randomBytes(32).toString("hex");
      next = { serverUrl, password, webhookToken };
    } else {
      const projectSecret = input.projectSecret || saved.projectSecret;
      const webhookSecret = input.webhookSecret || saved.webhookSecret;
      if (!projectSecret) throw new Error("Enter the project secret");
      if (!webhookSecret) throw new Error("Enter the webhook signing secret");
      next = {
        projectId: input.projectId,
        projectSecret,
        webhookSecret,
        ...(input.address ? { address: input.address } : {}),
      };
    }
    const stored = await this.secrets.put(JSON.stringify(next), context, {
      recordId: `integration-provider:${input.provider}`,
    });
    await this.prisma.integrationProviderConfig.upsert({
      where: { id: input.provider },
      create: { id: input.provider, ciphertext: stored.ciphertext },
      update: { ciphertext: stored.ciphertext },
    });
  }

  /** Connects with the effective settings (env first, then saved). */
  async test(id: IMessageProviderId): Promise<{ ok: true } | { ok: false; error: string }> {
    const e = await this.withSaved();
    try {
      if (id === "bluebubbles") {
        if (!e.bluebubblesUrl || !e.bluebubblesPassword || !e.bluebubblesWebhookToken)
          return { ok: false, error: "Not configured" };
        await new BlueBubblesAdapter({
          ...this.options.bluebubbles,
          serverUrl: e.bluebubblesUrl,
          password: e.bluebubblesPassword,
          webhookToken: e.bluebubblesWebhookToken,
        }).check();
      } else {
        if (!e.photonProjectId || !e.photonProjectSecret || !e.photonWebhookSecret)
          return { ok: false, error: "Not configured" };
        await new PhotonAdapter({
          ...this.options.photon,
          projectId: e.photonProjectId,
          projectSecret: e.photonProjectSecret,
          webhookSecret: e.photonWebhookSecret,
          ...(e.photonImessageAddress ? { address: e.photonImessageAddress } : {}),
        }).check();
      }
      return { ok: true };
    } catch (error) {
      // These errors are written without URLs or credentials (see the adapters).
      const known = error instanceof BlueBubblesError || error instanceof PhotonError;
      return { ok: false, error: known ? error.message : "Could not connect" };
    }
  }
}
