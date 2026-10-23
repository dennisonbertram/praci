import { ORPCError } from "@orpc/server";
import type { UpdaterProxyConfig } from "../server-update.js";
import {
  applyServerUpdate,
  checkServerUpdate,
  readServerUpdateStatus,
  UpdaterProxyError,
} from "../server-update.js";
import type { RouteContext, RouterDeps } from "./context.js";

export function createUpdaterRoutes({ deps, authed }: RouteContext) {
  return {
    status: authed.updater.status.handler(async ({ context }) => {
      if (!context.actor.isDeploymentOwner) throw new ORPCError("FORBIDDEN");
      return readServerUpdateStatus(updaterConfig(deps));
    }),
    check: authed.updater.check.handler(async ({ context, input }) => {
      if (!context.actor.isDeploymentOwner) throw new ORPCError("FORBIDDEN");
      try {
        return await checkServerUpdate(updaterConfig(deps), input);
      } catch (error) {
        mapUpdaterError(error);
      }
    }),
    apply: authed.updater.apply.handler(async ({ context, input }) => {
      if (!context.actor.isDeploymentOwner) throw new ORPCError("FORBIDDEN");
      try {
        return await applyServerUpdate(updaterConfig(deps), input);
      } catch (error) {
        mapUpdaterError(error);
      }
    }),
  };
}

function updaterConfig(deps: RouterDeps): UpdaterProxyConfig {
  return {
    url: deps.env.updaterUrl ?? null,
    token: deps.env.updaterToken ?? null,
    gitSha: deps.env.gitSha,
    imageTag: deps.env.imageTag ?? null,
  };
}

function mapUpdaterError(error: unknown): never {
  if (error instanceof UpdaterProxyError) {
    if (error.status === 401 || error.status === 403) {
      throw new ORPCError("FORBIDDEN", { message: error.message });
    }
    if (error.status >= 500) {
      throw new ORPCError("INTERNAL_SERVER_ERROR", { message: error.message });
    }
    throw new ORPCError("BAD_REQUEST", { message: error.message });
  }
  throw new ORPCError("INTERNAL_SERVER_ERROR", {
    message: error instanceof Error ? error.message : "Update failed.",
  });
}
