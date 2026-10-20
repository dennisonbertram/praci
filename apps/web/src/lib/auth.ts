import { organizationClient } from "better-auth/client/plugins";
import type { ReactAuthClient } from "better-auth/react";
import { createAuthClient } from "better-auth/react";

export const authClient: ReactAuthClient<{
  plugins: [ReturnType<typeof organizationClient>];
}> = createAuthClient({
  plugins: [organizationClient()],
});
