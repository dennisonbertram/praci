import { mkdirSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { startLocalHealthServer } from "../src/openapi-test-server.js";

const fixturePath = fileURLToPath(
  new URL(
    "../../../apps/ios/Packages/RakazoAPI/Tests/RakazoAPITests/Fixtures/health-response.json",
    import.meta.url,
  ),
);
const server = await startLocalHealthServer();

try {
  const response = await fetch(`${server.baseUrl}/rpc/health`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      origin: "rakazo://",
    },
    body: JSON.stringify({ json: undefined }),
  });
  if (!response.ok) {
    throw new Error(`Local health RPC returned HTTP ${response.status}: ${await response.text()}`);
  }
  const recorded = JSON.stringify(await response.json(), null, 2);
  mkdirSync(dirname(fixturePath), { recursive: true });
  writeFileSync(fixturePath, `${recorded}\n`);
} finally {
  await server.close();
}
