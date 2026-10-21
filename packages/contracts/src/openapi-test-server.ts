import { createServer } from "node:http";
import type { AddressInfo } from "node:net";
import { implement } from "@orpc/server";
import { RPCHandler } from "@orpc/server/fetch";
import { appContract } from "./rpc.js";

const healthContract = { health: appContract.health };
const os = implement(healthContract);
const router = os.router({
  health: os.health.handler(() => ({ ok: true as const, version: "0.1.0" })),
});
const rpc = new RPCHandler(router);

export async function startLocalHealthServer(): Promise<{
  baseUrl: string;
  close: () => Promise<void>;
}> {
  const server = createServer(async (request, response) => {
    const chunks: Buffer[] = [];
    for await (const chunk of request) {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    }

    const url = new URL(request.url ?? "/", "http://127.0.0.1");
    const headers = new Headers();
    for (const [name, value] of Object.entries(request.headers)) {
      if (value) headers.set(name, Array.isArray(value) ? value.join(", ") : value);
    }
    const rpcRequest = new Request(url, {
      method: request.method,
      headers,
      body: chunks.length ? Buffer.concat(chunks) : undefined,
    });
    const { matched, response: rpcResponse } = await rpc.handle(rpcRequest, {
      prefix: "/rpc",
      context: {},
    });

    if (!matched || !rpcResponse) {
      response.writeHead(404);
      response.end();
      return;
    }

    response.writeHead(rpcResponse.status, Object.fromEntries(rpcResponse.headers));
    response.end(Buffer.from(await rpcResponse.arrayBuffer()));
  });

  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });
  const address = server.address() as AddressInfo;

  return {
    baseUrl: `http://127.0.0.1:${address.port}`,
    close: () =>
      new Promise<void>((resolve, reject) => {
        server.close((error) => (error ? reject(error) : resolve()));
      }),
  };
}
