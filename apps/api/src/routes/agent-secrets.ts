import { deleteAgentSecret, listAgentSecrets, putAgentSecret } from "../agent-secrets.js";
import type { RouteContext } from "./context.js";

export function createAgentSecretsRoutes({ deps, ownerOnly }: RouteContext) {
  return {
    list: ownerOnly.agentSecrets.list.handler(async ({ context }) =>
      listAgentSecrets({ prisma: deps.prisma, secrets: deps.secrets }, context.actor),
    ),
    put: ownerOnly.agentSecrets.put.handler(async ({ context, input, signal }) =>
      putAgentSecret({ prisma: deps.prisma, secrets: deps.secrets }, context.actor, input, signal),
    ),
    remove: ownerOnly.agentSecrets.remove.handler(async ({ context, input }) =>
      deleteAgentSecret({ prisma: deps.prisma, secrets: deps.secrets }, context.actor, input.id),
    ),
  };
}
