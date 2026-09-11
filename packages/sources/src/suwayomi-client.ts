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
    return this.request<unknown>("/api/v1/source");
  }
  search(sourceId: string, query: string) {
    return this.request<unknown>(
      `/api/v1/source/${encodeURIComponent(sourceId)}/search`,
      { query },
    );
  }
  getManga(mangaId: string) {
    return this.request<unknown>(
      `/api/v1/manga/${encodeURIComponent(mangaId)}`,
    );
  }
  getChapters(mangaId: string) {
    return this.request<unknown>(
      `/api/v1/manga/${encodeURIComponent(mangaId)}/chapters`,
    );
  }
  getPage(mangaId: string, chapterIndex: number, pageIndex: number) {
    return this.request<unknown>(
      `/api/v1/manga/${encodeURIComponent(mangaId)}/chapter/${chapterIndex}/page/${pageIndex}`,
    );
  }
  private async request<T>(
    path: string,
    params?: Record<string, string | number>,
  ): Promise<T> {
    const url = new URL(`${this.baseUrl}${path}`);
    for (const [key, value] of Object.entries(params ?? {}))
      url.searchParams.set(key, String(value));
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);
    try {
      const response = await this.fetcher(url, {
        headers: { accept: "application/json" },
        signal: controller.signal,
      });
      if (!response.ok)
        throw new SuwayomiClientError(
          `Suwayomi returned HTTP ${response.status}.`,
          response.status,
        );
      try {
        return (await response.json()) as T;
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
