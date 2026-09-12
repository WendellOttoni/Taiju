import type { ReadingSource } from "./reading-source";

export type RuntimeCapability = "search" | "details" | "chapters" | "pages";
export type RuntimeCapabilityResult = {
  capability: RuntimeCapability;
  status: "passed" | "failed" | "skipped";
  message?: string;
};
export type RuntimeValidationReport = {
  sourceId: string;
  passed: boolean;
  results: RuntimeCapabilityResult[];
  mangaExternalId?: string;
  chapterExternalId?: string;
};

export type RuntimeValidationOptions = {
  query: string;
  /** Optional upper bound for the probe duration. */
  timeoutMs?: number;
};

/** Runs a bounded, source-isolated capability probe against a normalized source. */
export async function validateReadingSource(
  source: ReadingSource,
  options: RuntimeValidationOptions,
): Promise<RuntimeValidationReport> {
  if (!options.query.trim())
    throw new Error("Validation query must not be empty.");
  const timeoutMs = options.timeoutMs ?? 15_000;
  if (!Number.isInteger(timeoutMs) || timeoutMs < 1)
    throw new Error("Validation timeout must be a positive integer.");

  const results: RuntimeCapabilityResult[] = [];
  let mangaExternalId: string | undefined;
  let chapterExternalId: string | undefined;
  const run = async <T>(
    capability: RuntimeCapability,
    operation: () => Promise<T>,
  ) => {
    try {
      await withTimeout(operation(), timeoutMs);
      results.push({ capability, status: "passed" });
      return true;
    } catch (error) {
      results.push({
        capability,
        status: "failed",
        message: error instanceof Error ? error.message : "Validation failed.",
      });
      return false;
    }
  };

  const searchPassed = await run("search", async () => {
    const response = await source.search({ query: options.query, page: 1 });
    mangaExternalId = response.items[0]?.source.externalId;
    if (!mangaExternalId) throw new Error("Search returned no manga results.");
  });
  if (!searchPassed || mangaExternalId === undefined) {
    results.push({ capability: "details", status: "skipped" });
    results.push({ capability: "chapters", status: "skipped" });
    results.push({ capability: "pages", status: "skipped" });
    return report(source, results, mangaExternalId, chapterExternalId);
  }

  await run("details", () => source.details(mangaExternalId as string));
  let chapters: Awaited<ReturnType<ReadingSource["chapters"]>> | undefined;
  const chaptersPassed = await run("chapters", async () => {
    chapters = await source.chapters(mangaExternalId as string);
    chapterExternalId = chapters.items[0]?.source.externalId;
    if (!chapterExternalId)
      throw new Error("Chapter listing returned no chapters.");
  });
  if (chaptersPassed && chapterExternalId !== undefined)
    await run("pages", () => source.pages(chapterExternalId as string));
  else results.push({ capability: "pages", status: "skipped" });

  return report(source, results, mangaExternalId, chapterExternalId);
}

function report(
  source: ReadingSource,
  results: RuntimeCapabilityResult[],
  mangaExternalId: string | undefined,
  chapterExternalId: string | undefined,
): RuntimeValidationReport {
  return {
    sourceId: source.descriptor.id,
    passed: results.every((result) => result.status === "passed"),
    results,
    mangaExternalId,
    chapterExternalId,
  };
}

async function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<T>((_, reject) => {
        timer = setTimeout(
          () => reject(new Error("Validation timed out.")),
          timeoutMs,
        );
      }),
    ]);
  } finally {
    if (timer !== undefined) clearTimeout(timer);
  }
}
