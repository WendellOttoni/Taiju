export type SuwayomiClientOptions = {
  baseUrl: string;
  fetch?: (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;
  timeoutMs?: number;
};
export type SuwayomiSource = {
  id: string;
  language: string;
  name: string;
  packageName: string;
  version: string;
};
export type SuwayomiManga = {
  artist?: string;
  author?: string;
  description?: string;
  genres: string[];
  id: string;
  status: string;
  thumbnailUrl?: string;
  title: string;
};
export type SuwayomiChapter = {
  id: string;
  mangaId: string;
  name: string;
  number: number;
  scanlator?: string;
  uploadDate?: string;
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
  async listSources(): Promise<SuwayomiSource[]> {
    const data = await this.execute<{
      sources: {
        nodes: Array<{
          id: string;
          lang: string;
          name: string;
          extension: { pkgName: string; versionName: string };
        }>;
      };
    }>(
      "{ sources { nodes { id name lang extension { pkgName versionName } } } }",
    );
    return data.sources.nodes.map((source) => ({
      id: requireText(source.id, "source.id"),
      language: requireText(source.lang, "source.lang"),
      name: requireText(source.name, "source.name"),
      packageName: requireText(source.extension?.pkgName, "source.packageName"),
      version: requireText(source.extension?.versionName, "source.version"),
    }));
  }
  async search(
    sourceId: string,
    query: string,
    page = 1,
  ): Promise<{ hasNextPage: boolean; items: SuwayomiManga[] }> {
    const data = await this.execute<{
      fetchSourceManga: { hasNextPage: boolean; mangas: SuwayomiMangaDto[] };
    }>(
      "mutation ($input: FetchSourceMangaInput!) { fetchSourceManga(input: $input) { hasNextPage mangas { id title description genre thumbnailUrl status author artist } } }",
      { input: { page, query, source: sourceId, type: "SEARCH" } },
    );
    return {
      hasNextPage: data.fetchSourceManga.hasNextPage === true,
      items: data.fetchSourceManga.mangas.map(mapManga),
    };
  }
  async mangaAndChapters(mangaId: string): Promise<{
    chapters: SuwayomiChapter[];
    manga: SuwayomiManga;
  }> {
    const data = await this.execute<{
      fetchMangaAndChapters: {
        chapters: SuwayomiChapterDto[];
        manga: SuwayomiMangaDto;
      };
    }>(
      "mutation ($input: FetchMangaAndChaptersInput!) { fetchMangaAndChapters(input: $input) { manga { id title description genre thumbnailUrl status author artist } chapters { id mangaId name chapterNumber scanlator uploadDate } } }",
      {
        input: {
          fetchChapters: true,
          fetchManga: true,
          id: numericId(mangaId, "manga"),
        },
      },
    );
    return {
      manga: mapManga(data.fetchMangaAndChapters.manga),
      chapters: data.fetchMangaAndChapters.chapters.map(mapChapter),
    };
  }
  async chapterPages(chapterId: string): Promise<string[]> {
    const data = await this.execute<{
      fetchChapterPages: { pages: string[] };
    }>(
      "mutation ($input: FetchChapterPagesInput!) { fetchChapterPages(input: $input) { pages } }",
      { input: { chapterId: numericId(chapterId, "chapter") } },
    );
    if (
      !Array.isArray(data.fetchChapterPages.pages) ||
      data.fetchChapterPages.pages.some(
        (page) => typeof page !== "string" || page.length === 0,
      )
    )
      throw new SuwayomiClientError("Suwayomi returned invalid chapter pages.");
    return data.fetchChapterPages.pages;
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
      } catch (error) {
        if (error instanceof SuwayomiClientError) throw error;
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

type SuwayomiMangaDto = {
  artist?: unknown;
  author?: unknown;
  description?: unknown;
  genre?: unknown;
  id?: unknown;
  status?: unknown;
  thumbnailUrl?: unknown;
  title?: unknown;
};
type SuwayomiChapterDto = {
  chapterNumber?: unknown;
  id?: unknown;
  mangaId?: unknown;
  name?: unknown;
  scanlator?: unknown;
  uploadDate?: unknown;
};
function requireText(value: unknown, field: string): string {
  if (typeof value !== "string" || value.trim() === "")
    throw new SuwayomiClientError(`Suwayomi returned invalid ${field}.`);
  return value;
}
function optionalText(value: unknown, field: string): string | undefined {
  if (value === null || value === undefined || value === "") return undefined;
  return requireText(value, field);
}
function mapManga(manga: SuwayomiMangaDto): SuwayomiManga {
  if (!Array.isArray(manga.genre) || manga.genre.some((genre) => typeof genre !== "string"))
    throw new SuwayomiClientError("Suwayomi returned invalid manga genres.");
  return {
    artist: optionalText(manga.artist, "manga.artist"),
    author: optionalText(manga.author, "manga.author"),
    description: optionalText(manga.description, "manga.description"),
    genres: manga.genre,
    id: requireText(manga.id, "manga.id"),
    status: requireText(manga.status, "manga.status"),
    thumbnailUrl: optionalText(manga.thumbnailUrl, "manga.thumbnailUrl"),
    title: requireText(manga.title, "manga.title"),
  };
}
function mapChapter(chapter: SuwayomiChapterDto): SuwayomiChapter {
  if (typeof chapter.chapterNumber !== "number" || !Number.isFinite(chapter.chapterNumber))
    throw new SuwayomiClientError("Suwayomi returned invalid chapter number.");
  return {
    id: requireText(chapter.id, "chapter.id"),
    mangaId: requireText(chapter.mangaId, "chapter.mangaId"),
    name: requireText(chapter.name, "chapter.name"),
    number: chapter.chapterNumber,
    scanlator: optionalText(chapter.scanlator, "chapter.scanlator"),
    uploadDate: optionalText(chapter.uploadDate, "chapter.uploadDate"),
  };
}
function numericId(value: string, kind: string): number {
  if (!/^\d+$/.test(value))
    throw new SuwayomiClientError(`Invalid Suwayomi ${kind} identifier.`);
  const id = Number(value);
  if (!Number.isSafeInteger(id))
    throw new SuwayomiClientError(`Invalid Suwayomi ${kind} identifier.`);
  return id;
}
