import { deleteAgentSecret, listAgentSecrets, putAgentSecret } from "../agent-secrets.js";
import type { RouteContext } from "./context.js";

export function createAgentSecretsRoutes({ deps, authed }: RouteContext) {
  return {
    list: authed.agentSecrets.list.handler(async ({ context }) =>
      listAgentSecrets({ prisma: deps.prisma, secrets: deps.secrets }, context.actor),
    ),
    put: authed.agentSecrets.put.handler(async ({ context, input, signal }) =>
      putAgentSecret({ prisma: deps.prisma, secrets: deps.secrets }, context.actor, input, signal),
    ),
    remove: authed.agentSecrets.remove.handler(async ({ context, input }) =>
      deleteAgentSecret({ prisma: deps.prisma, secrets: deps.secrets }, context.actor, input.id),
    ),
  };
}
