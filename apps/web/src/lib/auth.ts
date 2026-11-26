import { oauthProviderClient } from "@better-auth/oauth-provider/client";
import { passkeyClient } from "@better-auth/passkey/client";
import { organizationClient } from "better-auth/client/plugins";
import { createAuthClient } from "better-auth/react";

export const authClient = createAuthClient({
  plugins: [organizationClient(), passkeyClient()],
  // Carries the signed authorize query of an outside app (an MCP client) through sign-in and
  // approval, so the member returns to it with a code. Only its request hook is used, which
  // keeps the plugin's server types out of the client type.
  fetchOptions: { plugins: oauthProviderClient().fetchPlugins },
});
