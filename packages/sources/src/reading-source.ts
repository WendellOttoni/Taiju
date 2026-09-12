import type {
  SourceChapterList,
  SourceDiscoveryQuery,
  SourceMangaDetails,
  SourceReaderChapter,
  SourceSearchQuery,
  SourceSearchResponse,
  SourceSummary,
} from "../../contracts/src";
import {
  sourceChapterListSchema,
  sourceMangaDetailsSchema,
  sourceReaderChapterSchema,
  sourceSearchResponseSchema,
} from "../../contracts/src";

import type {
  SuwayomiChapter,
  SuwayomiRuntimeClient,
} from "./suwayomi-client";

export type ReadingSource = {
  descriptor: SourceSummary;
  chapters(mangaExternalId: string): Promise<SourceChapterList>;
  details(mangaExternalId: string): Promise<SourceMangaDetails>;
  discover?(query: SourceDiscoveryQuery): Promise<SourceSearchResponse>;
  pages(chapterExternalId: string): Promise<SourceReaderChapter>;
  search(query: SourceSearchQuery): Promise<SourceSearchResponse>;
};

export class SuwayomiReadingSource implements ReadingSource {
  constructor(
    readonly descriptor: SourceSummary,
    private readonly runtimeSourceId: string,
    private readonly client: SuwayomiRuntimeClient,
  ) {}

  async search(query: SourceSearchQuery): Promise<SourceSearchResponse> {
    const result = await this.client.search(
      this.runtimeSourceId,
      query.query,
      query.page,
    );
    return sourceSearchResponseSchema.parse({
      hasNextPage: result.hasNextPage,
      items: result.items.map((manga) => ({
        coverUrl: manga.thumbnailUrl,
        description: manga.description,
        source: { externalId: manga.id, sourceId: this.descriptor.id },
        tags: manga.genres,
        title: manga.title,
      })),
    });
  }

  async discover(query: SourceDiscoveryQuery): Promise<SourceSearchResponse> {
    const result = await this.client.discover(
      this.runtimeSourceId,
      query.kind === "popular" ? "POPULAR" : "LATEST",
      query.page,
    );
    return sourceSearchResponseSchema.parse({
      hasNextPage: result.hasNextPage,
      items: result.items.map((manga) => ({
        coverUrl: manga.thumbnailUrl,
        description: manga.description,
        source: { externalId: manga.id, sourceId: this.descriptor.id },
        tags: manga.genres,
        title: manga.title,
      })),
    });
  }

  async details(mangaExternalId: string): Promise<SourceMangaDetails> {
    const { manga } = await this.client.mangaAndChapters(mangaExternalId);
    return sourceMangaDetailsSchema.parse({
      alternativeTitles: [],
      artists: manga.artist === undefined ? [] : [manga.artist],
      authors: manga.author === undefined ? [] : [manga.author],
      coverUrl: manga.thumbnailUrl,
      description: manga.description,
      source: { externalId: manga.id, sourceId: this.descriptor.id },
      status: normalizeStatus(manga.status),
      tags: manga.genres,
      title: manga.title,
    });
  }

  async chapters(mangaExternalId: string): Promise<SourceChapterList> {
    const { chapters } = await this.client.mangaAndChapters(mangaExternalId);
    return sourceChapterListSchema.parse({
      items: chapters.map((chapter) => this.mapChapter(chapter)),
    });
  }

  async pages(chapterExternalId: string): Promise<SourceReaderChapter> {
    const pageUrls = await this.client.chapterPages(chapterExternalId);
    return sourceReaderChapterSchema.parse({
      pageUrls,
      source: {
        externalId: chapterExternalId,
        sourceId: this.descriptor.id,
      },
    });
  }

  private mapChapter(chapter: SuwayomiChapter) {
    return {
      chapter: String(chapter.number),
      manga: { externalId: chapter.mangaId, sourceId: this.descriptor.id },
      publishedAt: timestampToIso(chapter.uploadDate),
      scanlationGroup: chapter.scanlator,
      source: { externalId: chapter.id, sourceId: this.descriptor.id },
      title: chapter.name,
    };
  }
}

function normalizeStatus(status: string) {
  switch (status.toLowerCase()) {
    case "ongoing":
      return "ongoing";
    case "completed":
    case "publishing_finished":
      return "completed";
    case "on_hiatus":
      return "hiatus";
    case "cancelled":
      return "cancelled";
    default:
      return "unknown";
  }
}

function timestampToIso(value: string | undefined) {
  if (value === undefined || !/^\d+$/.test(value)) return undefined;
  const date = new Date(Number(value));
  return Number.isNaN(date.valueOf()) ? undefined : date.toISOString();
}
