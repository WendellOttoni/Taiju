export const projectNoxCatalogUrl =
  "https://github.com/Awerkori/extensoes/raw/repo/index.pb";

const defaultTimeoutMs = 10_000;
const maxCatalogBytes = 10 * 1024 * 1024;

export class SourceCatalogError extends Error {
  override name = "SourceCatalogError";

  constructor(
    message: string,
    readonly status?: number,
  ) {
    super(message);
  }
}

export class SourceCatalogTimeoutError extends SourceCatalogError {
  override name = "SourceCatalogTimeoutError";

  constructor(readonly timeoutMs: number) {
    super(`The source catalog request exceeded ${timeoutMs}ms.`);
  }
}

export type SourceCatalogClientOptions = {
  baseUrl?: string;
  fetch?: typeof globalThis.fetch;
  timeoutMs?: number;
};

export class SourceCatalogClient {
  private readonly baseUrl: string;
  private readonly fetcher: typeof globalThis.fetch;
  private readonly timeoutMs: number;

  constructor(options: SourceCatalogClientOptions = {}) {
    this.baseUrl = options.baseUrl ?? projectNoxCatalogUrl;
    this.fetcher = options.fetch ?? globalThis.fetch;
    this.timeoutMs = options.timeoutMs ?? defaultTimeoutMs;
    if (!Number.isInteger(this.timeoutMs) || this.timeoutMs < 1)
      throw new Error("Source catalog timeout must be a positive integer.");
    new URL(this.baseUrl);
  }

  async fetchCatalog(
    options: { signal?: AbortSignal } = {},
  ): Promise<Uint8Array> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);
    const abortExternal = () => controller.abort();
    options.signal?.addEventListener("abort", abortExternal, { once: true });
    try {
      const response = await this.fetcher(this.baseUrl, {
        headers: { accept: "application/octet-stream" },
        signal: controller.signal,
      });
      if (!response.ok)
        throw new SourceCatalogError(
          `The source catalog returned HTTP ${response.status}.`,
          response.status,
        );
      const bytes = new Uint8Array(await response.arrayBuffer());
      if (bytes.length === 0)
        throw new SourceCatalogError("The source catalog response was empty.");
      if (bytes.length > maxCatalogBytes)
        throw new SourceCatalogError(
          "The source catalog response is too large.",
        );
      return bytes;
    } catch (error) {
      if (error instanceof SourceCatalogError) throw error;
      if (controller.signal.aborted) {
        if (options.signal?.aborted)
          throw new SourceCatalogError(
            "The source catalog request was cancelled.",
          );
        throw new SourceCatalogTimeoutError(this.timeoutMs);
      }
      throw new SourceCatalogError("The source catalog request failed.");
    } finally {
      clearTimeout(timeout);
      options.signal?.removeEventListener("abort", abortExternal);
    }
  }
}
