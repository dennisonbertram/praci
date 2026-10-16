const hasCode = (error: unknown, code: string): boolean =>
  Boolean(error && typeof error === "object" && "code" in error && error.code === code);

/** Prisma P2002: a unique constraint failed. */
export const isUniqueViolation = (error: unknown): boolean => hasCode(error, "P2002");

/** Prisma P2025: the record an update or delete targeted does not exist. */
export const isRecordNotFound = (error: unknown): boolean => hasCode(error, "P2025");
