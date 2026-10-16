import type { Me } from "@rakazo/contracts";

export const mockMe: Me = {
  ticketBoardEnabled: false,
  userId: "user_demo",
  email: "demo@example.test",
  name: "Demo User",
  spaceId: "space_demo",
  isDeploymentOwner: true,
  needsModel: false,
  defaultProvider: "sample-ai",
  defaultModel: "sample-large",
  hostCredentialProvider: null,
  hostCredentialSource: null,
  computerHost: null,
  canChooseHostComputer: false,
  sandboxProvider: "none",
  avatarStyle: "robot",
  billingEnabled: false,
};
