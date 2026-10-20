import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import type { AdapterContext, JobPublisher } from "@rakazo/adapter-kit";
import type { PrismaClient, ThreadEvents } from "@rakazo/db";
import { afterEach, describe, expect, it, vi } from "vitest";
import { LocalArtifactStore } from "./artifacts.js";
import { ComputerBusyError, provisionComputer } from "./computer-lifecycle.js";
import { DockerSandboxProvider } from "./docker-sandbox.js";
import { FakeSandboxProvider } from "./fake-sandbox.js";
import { LocalAgentHomeStore } from "./home.js";
import { HostAwareSandbox } from "./host-aware-sandbox.js";
import { ObjectAgentHomeStore } from "./object-home.js";

const context = {
  operationId: "test",
  traceId: "test",
  spaceId: "space",
  userId: "user",
  botId: "bot",
  signal: new AbortController().signal,
} satisfies AdapterContext;

async function fixture() {
  const directory = await mkdtemp(path.join(process.cwd(), ".computer-reuse-"));
  const row = {
    id: "computer",
    homeKey: "bot",
    providerRef: "provider",
    kind: "docker",
    scope: "team",
    state: "running",
    screenGeneration: 7,
    maintenanceId: null as string | null,
    controlLeaseId: null,
    updatedAt: new Date("2024-01-01T00:00:00Z"),
  };
  let assigned = true;
  const updateMany = vi.fn(async ({ where, data }) => {
    if (
      !assigned ||
      Object.entries(where).some(
        ([key, value]) => key in row && row[key as keyof typeof row] !== value,
      )
    )
      return { count: 0 };
    // Model the database trigger that revokes viewers on a lifecycle transition.
    if (
      data.state &&
      data.state !== row.state &&
      !(row.state === "booting" && data.state === "running")
    ) {
      row.screenGeneration++;
    }
    Object.assign(row, data);
    return { count: 1 };
  });
  const docker = new DockerSandboxProvider("http://supervisor.test", "test-token");
  const ref = {
    id: "provider",
    providerRef: "provider",
    botId: "bot",
    kind: "docker" as const,
    fresh: false,
  };
  const provision = vi.spyOn(docker, "provision").mockResolvedValue(ref);
  const prepare = vi.spyOn(docker, "prepare");
  const execute = vi.spyOn(docker, "execute").mockImplementation(async function* () {
    yield { type: "exit", code: 0 };
  });
  const sandbox = new HostAwareSandbox(docker, new FakeSandboxProvider(), async () => false);
  const deps = {
    prisma: {
      computer: { findUniqueOrThrow: vi.fn(async () => ({ ...row })), updateMany },
    } as unknown as PrismaClient,
    sandbox,
    home: new LocalAgentHomeStore(directory),
    jobs: {} as JobPublisher,
    events: {} as ThreadEvents,
    dataDir: directory,
  };
  return {
    row,
    deps,
    provision,
    prepare,
    execute,
    updateMany,
    unassign: () => {
      assigned = false;
    },
    cleanup: () => rm(directory, { recursive: true, force: true }),
  };
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("running Docker computer reuse", () => {
  it.each([true, false, "unavailable", "stopped"])(
    "preserves viewer authorization only for a confirmed running reference: %s",
    async (running) => {
      const f = await fixture();
      const fetchMock = vi.fn(async () =>
        Response.json(
          { running: running === true },
          { status: running === "unavailable" ? 503 : 200 },
        ),
      );
      vi.stubGlobal("fetch", fetchMock);
      if (running === "stopped") f.row.state = "stopped";
      try {
        await provisionComputer(f.deps, "computer", context, "bot");
        expect(f.row.state).toBe("running");
        expect(f.row.screenGeneration).toBe(running === true ? 7 : 8);
        expect(f.provision).toHaveBeenCalledTimes(running === true ? 0 : 1);
        expect(f.prepare).toHaveBeenCalledOnce();
        expect(f.execute).toHaveBeenCalledWith(
          expect.objectContaining({ providerRef: "provider" }),
          expect.objectContaining({ argv: expect.arrayContaining(["mkdir", "shared"]) }),
          context,
        );
        if (running !== "stopped") {
          expect(fetchMock).toHaveBeenCalledWith(
            "http://supervisor.test/computers/provider",
            expect.objectContaining({
              method: "GET",
              headers: expect.objectContaining({
                "x-rakazo-bot-id": "bot",
                "x-rakazo-space-id": "space",
              }),
            }),
          );
        } else expect(fetchMock).not.toHaveBeenCalled();
      } finally {
        await f.cleanup();
      }
    },
  );

  it.each(["state", "provider", "kind", "generation", "maintenance", "ownership", "cancel"])(
    "rejects reuse when %s changes during the read-only probe",
    async (change) => {
      const f = await fixture();
      const abort = new AbortController();
      vi.stubGlobal(
        "fetch",
        vi.fn(async () => {
          if (change === "state") f.row.state = "stopped";
          if (change === "provider") f.row.providerRef = "replacement";
          if (change === "kind") f.row.kind = "desktop";
          if (change === "generation") f.row.screenGeneration++;
          if (change === "maintenance") f.row.maintenanceId = "maintenance";
          if (change === "ownership") f.unassign();
          if (change === "cancel") abort.abort(new Error("cancelled"));
          return Response.json({ running: true });
        }),
      );
      try {
        await expect(
          provisionComputer(f.deps, "computer", { ...context, signal: abort.signal }),
        ).rejects.toThrow(change === "cancel" ? "cancelled" : new ComputerBusyError());
        if (change !== "cancel") {
          expect(f.updateMany).toHaveBeenCalledWith(
            expect.objectContaining({
              where: expect.objectContaining({ bots: { some: { id: "bot", archivedAt: null } } }),
            }),
          );
        } else expect(f.updateMany).not.toHaveBeenCalled();
        expect(f.provision).not.toHaveBeenCalled();
        expect(f.prepare).not.toHaveBeenCalled();
      } finally {
        await f.cleanup();
      }
    },
  );

  it("installs the snapshot of a Computer that last ran elsewhere before Docker mounts it", async () => {
    const f = await fixture();
    try {
      // The row last ran on E2B; Docker provisions it now, and homes/<key> holds an old copy.
      Object.assign(f.row, {
        kind: "e2b",
        state: "stopped",
        providerRef: "e2b-sandbox",
        spaceId: "space",
        homeRevision: "empty",
        homeSnapshotId: null,
        homePreviousSnapshotId: null,
      });
      const computer = f.deps.prisma.computer as unknown as Record<string, unknown>;
      computer.findFirst = vi.fn(async () => ({ ...f.row }));
      const home = new ObjectAgentHomeStore(
        f.deps.prisma as never,
        new LocalArtifactStore(f.deps.dataDir),
        f.deps.dataDir,
      );
      const src = path.join(f.deps.dataDir, "src");
      await mkdir(src);
      await writeFile(path.join(src, "work.txt"), "saved on e2b");
      await home.commit("bot", src, context);
      const stale = path.join(f.deps.dataDir, "homes", "bot");
      await mkdir(stale, { recursive: true });
      await writeFile(path.join(stale, "work.txt"), "old docker copy");
      let mounted: string | undefined;
      f.provision.mockImplementation(async (request) => {
        mounted = await readFile(path.join(request.homePath, "work.txt"), "utf8");
        return {
          id: "provider",
          providerRef: "provider",
          botId: "bot",
          kind: "docker",
          fresh: true,
        };
      });
      const importWorkspace = vi.spyOn(f.deps.sandbox, "importWorkspace");
      await provisionComputer({ ...f.deps, home }, "computer", context, "bot");
      expect(mounted).toBe("saved on e2b");
      expect(importWorkspace).not.toHaveBeenCalled();
    } finally {
      await f.cleanup();
    }
  });
});
