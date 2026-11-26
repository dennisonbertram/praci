import type { PrismaClient } from "../client.js";

type Hook = (model: string, method: string) => Promise<void> | void;

/** Wraps every `$transaction` callback so `hook` runs before and `after` runs after a delegate call. */
function hooked(prisma: PrismaClient, only: string, before: Hook, after: Hook): PrismaClient {
  const wrap = (tx: object) =>
    new Proxy(tx, {
      get(target, model, receiver) {
        const delegate = Reflect.get(target, model, receiver);
        if (model !== only || !delegate || typeof delegate !== "object") return delegate;
        return new Proxy(delegate, {
          get(inner, method, innerReceiver) {
            const operation = Reflect.get(inner, method, innerReceiver);
            if (typeof method !== "string" || typeof operation !== "function") return operation;
            return async (...args: unknown[]) => {
              await before(model, method);
              const result = await Reflect.apply(operation, inner, args);
              await after(model, method);
              return result;
            };
          },
        });
      },
    });
  return new Proxy(prisma, {
    get(target, property, receiver) {
      if (property !== "$transaction") return Reflect.get(target, property, receiver);
      const transaction = Reflect.get(target, property, target) as (...args: unknown[]) => unknown;
      return (...args: unknown[]) => {
        const callback = args[0];
        if (typeof callback !== "function") return Reflect.apply(transaction, target, args);
        return Reflect.apply(transaction, target, [
          (tx: object) => Reflect.apply(callback, undefined, [wrap(tx)]),
          ...args.slice(1),
        ]);
      };
    },
  });
}

/** Holds each caller of `model.method` until `participants` callers have reached it. */
export function meetBefore(
  prisma: PrismaClient,
  model: string,
  methods: string[],
  participants = 2,
): PrismaClient {
  let arrived = 0;
  let release!: () => void;
  const gate = new Promise<void>((resolve) => (release = resolve));
  return hooked(
    prisma,
    model,
    async (m, method) => {
      if (m !== model || !methods.includes(method) || arrived >= participants) return;
      arrived += 1;
      if (arrived === participants) release();
      await gate;
    },
    () => {},
  );
}

/** Pauses the first `model.method` call right after it returns, until `resume()` is called. */
export function pauseAfter(prisma: PrismaClient, model: string, method: string) {
  let signal!: () => void;
  let resume!: () => void;
  let paused = false;
  const reached = new Promise<void>((resolve) => (signal = resolve));
  const gate = new Promise<void>((resolve) => (resume = resolve));
  const isolated = hooked(
    prisma,
    model,
    () => {},
    async (m, name) => {
      if (m !== model || name !== method || paused) return;
      paused = true;
      signal();
      await gate;
    },
  );
  return { prisma: isolated, reached, resume };
}
