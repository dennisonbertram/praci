import type { Socket } from "node:net";
import { loadRootEnv } from "@rakazo/core/node/load-root-env";

loadRootEnv();

import { serve } from "@hono/node-server";
import { SERVICE_NAMES } from "@rakazo/logging";
import { createRootLogger } from "@rakazo/logging/axiom";
import { createApp } from "./app.js";
import { loadEnv } from "./env.js";

const logger = createRootLogger(SERVICE_NAMES.api);

try {
  const env = loadEnv();
  const { app, stop } = await createApp({ ...env, logger });
  const server = serve({ fetch: app.fetch, port: env.port, hostname: env.apiHost }, () => {
    logger.info("api listening", { "http.host": env.apiHost, "http.port": env.port });
  });
  // Node cuts a request off after 300 s by default, which ends a large Data room upload. Zero
  // would also remove the server's guard against a client that stalls mid-body, so allow 12 h.
  if ("requestTimeout" in server) server.requestTimeout = 12 * 60 * 60 * 1000;

  // Long-lived connections (threads.subscribe SSE streams) never end on their
  // own, so server.close() alone waits forever for them. Track sockets and
  // force-close any still open after a short grace period for in-flight
  // requests, or every restart/shutdown hangs until something force-kills it.
  const sockets = new Set<Socket>();
  server.on("connection", (socket) => {
    sockets.add(socket);
    socket.once("close", () => sockets.delete(socket));
  });

  let stopping = false;
  const shutdown = async () => {
    if (stopping) return;
    stopping = true;
    const closed = new Promise<void>((resolve) => server.close(() => resolve()));
    const grace = setTimeout(() => {
      for (const socket of sockets) socket.destroy();
    }, 2_000);
    await closed;
    clearTimeout(grace);
    await stop();
    await logger.flush({ timeoutMs: 2_000 });
  };
  process.once("SIGTERM", () => void shutdown());
  process.once("SIGINT", () => void shutdown());
} catch (error) {
  logger.error("api startup failed", error);
  await logger.flush({ timeoutMs: 2_000 });
  process.exit(1);
}
