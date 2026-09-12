import { desc, eq } from "drizzle-orm";

import type { TaijuDatabase } from "./client";
import { sourceRuntimeValidations } from "./schema";

export type RuntimeValidationSnapshot = {
  checkedAt: Date;
  passed: boolean;
  query: string;
  report: unknown;
  sourceId: string;
};

export type RuntimeValidationRepository = {
  save(snapshot: Omit<RuntimeValidationSnapshot, "checkedAt">): Promise<void>;
  list(sourceId?: string, limit?: number): Promise<RuntimeValidationSnapshot[]>;
};

export function createRuntimeValidationRepository(
  database: TaijuDatabase,
): RuntimeValidationRepository {
  return {
    async save(snapshot) {
      await database.insert(sourceRuntimeValidations).values(snapshot);
    },
    async list(sourceId, limit = 50) {
      const boundedLimit = Math.min(Math.max(Math.trunc(limit), 1), 200);
      const query = database
        .select({
          checkedAt: sourceRuntimeValidations.checkedAt,
          passed: sourceRuntimeValidations.passed,
          query: sourceRuntimeValidations.query,
          report: sourceRuntimeValidations.report,
          sourceId: sourceRuntimeValidations.sourceId,
        })
        .from(sourceRuntimeValidations)
        .orderBy(desc(sourceRuntimeValidations.checkedAt))
        .limit(boundedLimit);
      return sourceId === undefined
        ? query
        : query.where(eq(sourceRuntimeValidations.sourceId, sourceId));
    },
  };
}
