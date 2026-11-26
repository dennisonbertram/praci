import type { Server } from "node:http";
import { loadRootEnv } from "@rakazo/core/node/load-root-env";

loadRootEnv();

import { serve } from "@hono/node-server";
import { SERVICE_NAMES } from "@rakazo/logging";
import { createRootLogger } from "@rakazo/logging/axiom";
import { createApp } from "./app.js";
import { trackConnections } from "./drain.js";
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

  // The deploy allows 30 seconds after the stop signal; leave time for stop() and the log flush.
  const drain = trackConnections(server as Server);
  // Outlive the proxy's 2-minute idle reuse, or a request can hit a socket Node just closed.
  (server as Server).keepAliveTimeout = 125_000;

  let stopping = false;
  const shutdown = async () => {
    if (stopping) return;
    stopping = true;
    await drain(20_000);
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
