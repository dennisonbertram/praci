import { ORPCError } from "@orpc/server";
import { EquityConflictError, EquityInputError } from "@rakazo/db";

/**
 * Runs an equity store call and answers its refusals: a conflict is CONFLICT, an unacceptable
 * input or a schema failure is BAD_REQUEST. A record outside the caller's ledger is already
 * NOT_FOUND (IsolationError, mapped by the authed middleware).
 */
export async function equityCall<T>(fn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch (error) {
    if (error instanceof EquityConflictError)
      throw new ORPCError("CONFLICT", { message: error.message });
    if (error instanceof EquityInputError)
      throw new ORPCError("BAD_REQUEST", { message: error.message });
    if (error instanceof Error && error.name === "ZodError")
      throw new ORPCError("BAD_REQUEST", { message: "Invalid cap table input" });
    throw error;
  }
}

/** Placeholder for a procedure its owning worker has not built yet. */
export const notBuilt = (): never => {
  throw new ORPCError("NOT_IMPLEMENTED", { message: "Not built yet" });
};
