import { createHash, randomUUID } from "node:crypto";
import { constants, createReadStream, createWriteStream } from "node:fs";
import { mkdir, open, rm } from "node:fs/promises";
import path from "node:path";
import { pipeline } from "node:stream/promises";
import type { AdapterContext, ArtifactPut, ArtifactStore } from "@rakazo/adapter-kit";

const O_NOFOLLOW = constants.O_NOFOLLOW ?? 0;

export class LocalArtifactStore implements ArtifactStore {
  constructor(private readonly root: string) {}

  describe() {
    return {
      id: "local-artifacts",
      contractVersion: "1",
      adapterVersion: "0.1.0",
      capabilities: { stream: true },
    };
  }

  async put(artifact: ArtifactPut, context: AdapterContext) {
    const id = randomUUID();
    const dir = path.join(this.root, "artifacts", context.spaceId);
    await mkdir(dir, { recursive: true });
    const file = path.join(dir, id);
    const handle = await open(
      file,
      constants.O_WRONLY | constants.O_CREAT | constants.O_EXCL | O_NOFOLLOW,
      0o600,
    );
    try {
      await handle.writeFile(artifact.bytes);
    } finally {
      await handle.close();
    }
    return { id, hash: createHash("sha256").update(artifact.bytes).digest("hex") };
  }

  async putFile(file: { path: string }, context: AdapterContext) {
    const id = randomUUID();
    const dir = path.join(this.root, "artifacts", context.spaceId);
    await mkdir(dir, { recursive: true });
    const hash = createHash("sha256");
    const target = path.join(dir, id);
    try {
      await pipeline(
        createReadStream(file.path),
        async function* (source) {
          for await (const chunk of source) {
            hash.update(chunk);
            yield chunk;
          }
        },
        createWriteStream(target, { flags: "wx", mode: 0o600 }),
      );
    } catch (error) {
      await rm(target, { force: true });
      throw error;
    }
    return { id, hash: hash.digest("hex") };
  }

  async getFile(id: string, destination: string, context: AdapterContext) {
    const handle = await open(
      path.join(this.root, "artifacts", context.spaceId, id),
      constants.O_RDONLY | O_NOFOLLOW,
    );
    await pipeline(
      handle.createReadStream(),
      createWriteStream(destination, { flags: "wx", mode: 0o600 }),
    );
  }

  async get(id: string, context: AdapterContext) {
    const handle = await open(
      path.join(this.root, "artifacts", context.spaceId, id),
      constants.O_RDONLY | O_NOFOLLOW,
    );
    try {
      return new Uint8Array(await handle.readFile());
    } finally {
      await handle.close();
    }
  }

  async remove(id: string, context: AdapterContext) {
    await rm(path.join(this.root, "artifacts", context.spaceId, id), { force: true });
  }
}
