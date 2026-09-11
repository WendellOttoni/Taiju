export type MangaDexRateLimit = {
  limit?: number;
  remaining?: number;
  retryAfter?: number;
};

export class MangaDexHttpError extends Error {
  override name: string = "MangaDexHttpError";

  constructor(
    message: string,
    readonly status: number,
    readonly rateLimit: MangaDexRateLimit,
  ) {
    super(message);
  }
}

export class MangaDexRateLimitError extends MangaDexHttpError {
  override name: string = "MangaDexRateLimitError";

  constructor(rateLimit: MangaDexRateLimit) {
    super("MangaDex rate limit exceeded.", 429, rateLimit);
  }
}

export class MangaDexTimeoutError extends Error {
  override name: string = "MangaDexTimeoutError";

  constructor(readonly timeoutMs: number) {
    super(`MangaDex request exceeded the ${timeoutMs}ms timeout.`);
  }
}
