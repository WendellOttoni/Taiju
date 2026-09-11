export type SuwayomiClientOptions = {
  baseUrl: string;
  fetch?: (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;
  timeoutMs?: number;
};
export class SuwayomiClientError extends Error {
  override name = "SuwayomiClientError";
  constructor(
    message: string,
    readonly status?: number,
  ) {
    super(message);
  }
}
export class SuwayomiClientTimeoutError extends SuwayomiClientError {
  override name = "SuwayomiClientTimeoutError";
}
export class SuwayomiRuntimeClient {
  private readonly baseUrl: string;
  private readonly fetcher: NonNullable<SuwayomiClientOptions["fetch"]>;
  private readonly timeoutMs: number;
  constructor(options: SuwayomiClientOptions) {
    this.baseUrl = options.baseUrl.replace(/\/$/, "");
    new URL(this.baseUrl);
    this.fetcher =
      options.fetch ?? ((input, init) => globalThis.fetch(input, init));
    this.timeoutMs = options.timeoutMs ?? 15_000;
    if (!Number.isInteger(this.timeoutMs) || this.timeoutMs < 1)
      throw new Error("Suwayomi timeout must be a positive integer.");
  }
  listSources() {
    return this.execute<unknown>(
      "{ sources { nodes { id name lang homeUrl extension { pkgName } } } }",
    );
  }
  async execute<T>(
    query: string,
    variables?: Record<string, unknown>,
  ): Promise<T> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);
    try {
      const response = await this.fetcher(`${this.baseUrl}/api/graphql`, {
        method: "POST",
        headers: {
          accept: "application/json",
          "content-type": "application/json",
        },
        body: JSON.stringify({ query, variables }),
        signal: controller.signal,
      });
      if (!response.ok)
        throw new SuwayomiClientError(
          `Suwayomi returned HTTP ${response.status}.`,
          response.status,
        );
      try {
        const payload = (await response.json()) as {
          data?: T;
          errors?: Array<{ message?: string }>;
        };
        if (payload.errors?.length)
          throw new SuwayomiClientError(
            payload.errors[0]?.message ?? "Suwayomi returned a GraphQL error.",
          );
        if (payload.data === undefined)
          throw new SuwayomiClientError("Suwayomi returned no GraphQL data.");
        return payload.data;
      } catch {
        throw new SuwayomiClientError("Suwayomi returned invalid JSON.");
      }
    } catch (error) {
      if (controller.signal.aborted)
        throw new SuwayomiClientTimeoutError(
          `Suwayomi request exceeded ${this.timeoutMs}ms.`,
        );
      if (error instanceof SuwayomiClientError) throw error;
      throw new SuwayomiClientError("Suwayomi request failed.");
    } finally {
      clearTimeout(timer);
    }
  }
}
