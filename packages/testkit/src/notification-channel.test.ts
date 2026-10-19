import { ExpoPushProvider } from "@rakazo/adapters";
import { afterEach, vi } from "vitest";
import { describeNotificationChannelConformance } from "./notification-channel-conformance.js";

afterEach(() => vi.unstubAllGlobals());

// The push channel against a fake Expo transport and an in-memory endpoint table.
describeNotificationChannelConformance("push (Expo)", () => {
  const endpoint = { id: "endpoint-1", address: "ExponentPushToken[abc12345]", sessionId: null };
  let endpoints = [endpoint];
  const received: string[] = [];
  let reply: () => Response = () => Response.json({ data: { status: "ok" } });
  vi.stubGlobal(
    "fetch",
    vi.fn(async (_url: string, init: { body: string }) => {
      const response = reply();
      if (response.ok) received.push(JSON.parse(init.body).data.notificationId);
      return response;
    }),
  );
  const prisma = {
    notificationEndpoint: { findMany: async () => endpoints },
  } as unknown as ConstructorParameters<typeof ExpoPushProvider>[0];
  return {
    channel: new ExpoPushProvider(prisma),
    endpoint,
    removeEndpoint: () => {
      endpoints = [];
    },
    transport: {
      accept: () => {
        reply = () => Response.json({ data: { status: "ok" } });
      },
      fail: () => {
        reply = () => new Response("{}", { status: 500 });
      },
      reportEndpointGone: () => {
        reply = () =>
          Response.json({
            data: {
              status: "error",
              message: "not registered",
              details: { error: "DeviceNotRegistered" },
            },
          });
      },
      sent: () => [...received],
    },
  };
});
