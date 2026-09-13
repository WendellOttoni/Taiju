import {
  type AnimeDetails,
  type AnimeEpisodeList,
  type AnimeSearchQuery,
  type AnimeSearchResponse,
  type AnimeSource,
  type AnimeStreamResponse,
  animeDetailsSchema,
  animeEpisodeListSchema,
  animeSearchResponseSchema,
  animeSourceSchema,
  animeStreamResponseSchema,
} from "@taiju/contracts";
import { z } from "zod";

export type MiwayomiClientOptions = {
  baseUrl: string;
  fetch?: (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;
  timeoutMs?: number;
};

export class MiwayomiClientError extends Error {
  override name = "MiwayomiClientError";

  constructor(
    message: string,
    readonly status?: number,
  ) {
    super(message);
  }
}

export class MiwayomiClientTimeoutError extends MiwayomiClientError {
  override name = "MiwayomiClientTimeoutError";
}

export class MiwayomiContentUnavailableError extends MiwayomiClientError {
  override name = "MiwayomiContentUnavailableError";
}

export class MiwayomiPlaybackError extends MiwayomiClientError {
  override name = "MiwayomiPlaybackError";
}

const runtimeSourceSchema = z.object({
  id: z.string().trim().min(1),
  lang: z.string().trim().min(1),
  name: z.string().trim().min(1),
  pkg: z.string().trim().min(1).optional(),
  type: z.string().trim().min(1),
});

const runtimeSourcesSchema = z.object({ anime: z.array(runtimeSourceSchema) });

const runtimeAnimeSchema = z.object({
  artist: z.string().nullable().optional(),
  author: z.string().nullable().optional(),
  background_url: z.string().url().nullable().optional(),
  description: z.string().nullable().optional(),
  genre: z.string().nullable().optional(),
  status: z.number().int(),
  thumbnail_url: z.string().url().nullable().optional(),
  title: z.string().trim().min(1),
  url: z.string().trim().min(1),
});

const runtimeAnimePageSchema = z.object({
  animes: z.array(runtimeAnimeSchema),
  hasNextPage: z.boolean(),
});

const runtimeEpisodeSchema = z.object({
  episode_number: z.number().finite().optional(),
  name: z.string().trim().min(1),
  preview_url: z.string().url().nullable().optional(),
  summary: z.string().nullable().optional(),
  url: z.string().trim().min(1),
});

const runtimeEpisodesSchema = z.object({ episodes: z.array(runtimeEpisodeSchema) });

const runtimeTrackSchema = z.object({
  lang: z.string().trim().min(1),
  url: z.string().url(),
});

const runtimeVideoSchema = z.object({
  audioTracks: z.array(runtimeTrackSchema).default([]),
  bitrate: z.number().int().positive().nullable().optional(),
  preferred: z.boolean().default(false),
  resolution: z.number().int().positive().nullable().optional(),
  subtitleTracks: z.array(runtimeTrackSchema).default([]),
  videoTitle: z.string().trim().min(1),
  videoUrl: z.string().url(),
  headers: z.record(z.string(), z.string()).default({}),
});

const runtimeVideosSchema = z.object({ videos: z.array(runtimeVideoSchema) });

/** Isolated HTTP boundary for the Miwayomi Aniyomi-extension runtime. */
export class MiwayomiClient {
  private readonly baseUrl: string;
  private readonly fetcher: NonNullable<MiwayomiClientOptions["fetch"]>;
  private readonly timeoutMs: number;

  constructor(options: MiwayomiClientOptions) {
    this.baseUrl = options.baseUrl.replace(/\/$/, "");
    new URL(this.baseUrl);
    this.fetcher =
      options.fetch ?? ((input, init) => globalThis.fetch(input, init));
    this.timeoutMs = options.timeoutMs ?? 30_000;
    if (!Number.isInteger(this.timeoutMs) || this.timeoutMs < 1)
      throw new Error("Miwayomi timeout must be a positive integer.");
  }

  async listSources(): Promise<AnimeSource[]> {
    const payload = runtimeSourcesSchema.parse(await this.get("/sources"));
    return payload.anime
      .map((source) =>
        animeSourceSchema.safeParse({
          id: source.id,
          language: normalizeLanguage(source.lang),
          name: source.name,
          packageName: source.pkg,
        }),
      )
      .flatMap((result) => (result.success ? [result.data] : []));
  }

  async search(
    sourceId: string,
    query: AnimeSearchQuery,
  ): Promise<AnimeSearchResponse> {
    const payload = runtimeAnimePageSchema.parse(
      await this.get(`/anime/${encodeURIComponent(sourceId)}/search`, {
        page: String(query.page),
        query: query.query,
      }),
    );
    return animeSearchResponseSchema.parse({
      hasNextPage: payload.hasNextPage,
      items: payload.animes.map((anime) => mapAnimeSummary(anime, sourceId)),
    });
  }

  async details(sourceId: string, animeUrl: string): Promise<AnimeDetails> {
    const anime = runtimeAnimeSchema.parse(
      await this.get(`/anime/${encodeURIComponent(sourceId)}/details`, {
        url: animeUrl,
      }),
    );
    return animeDetailsSchema.parse({
      ...mapAnimeSummary(anime, sourceId),
      alternativeTitles: [],
      artists: asList(anime.artist),
      authors: asList(anime.author),
      backgroundUrl: anime.background_url ?? undefined,
      status: normalizeStatus(anime.status),
    });
  }

  async episodes(
    sourceId: string,
    animeUrl: string,
  ): Promise<AnimeEpisodeList> {
    const payload = runtimeEpisodesSchema.parse(
      await this.get(`/anime/${encodeURIComponent(sourceId)}/episodes`, {
        url: animeUrl,
      }),
    );
    return animeEpisodeListSchema.parse({
      items: payload.episodes.map((episode) => ({
        anime: { externalId: animeUrl, sourceId },
        description: episode.summary ?? undefined,
        number: episode.episode_number,
        previewUrl: episode.preview_url ?? undefined,
        source: { externalId: episode.url, sourceId },
        title: episode.name,
      })),
    });
  }

  async streams(
    sourceId: string,
    episodeUrl: string,
  ): Promise<AnimeStreamResponse> {
    const payload = await this.getVideos(sourceId, episodeUrl);
    if (payload.videos.length === 0)
      throw new MiwayomiContentUnavailableError(
        "The source did not return playable streams for this episode.",
      );
    return animeStreamResponseSchema.parse({
      items: payload.videos.map((video) => ({
        audioTracks: video.audioTracks.map(mapTrack),
        bitrate: video.bitrate ?? undefined,
        isPreferred: video.preferred,
        quality: video.resolution ?? undefined,
        source: { externalId: episodeUrl, sourceId },
        subtitleTracks: video.subtitleTracks.map(mapTrack),
        title: video.videoTitle,
        url: video.videoUrl,
      })),
    });
  }

  async proxyStream(
    sourceId: string,
    episodeUrl: string,
    streamIndex: number,
    range?: string,
  ): Promise<Response> {
    const payload = await this.getVideos(sourceId, episodeUrl);
    const video = payload.videos[streamIndex];
    if (video === undefined)
      throw new MiwayomiContentUnavailableError("The selected video was not found.");

    const headers = new Headers(video.headers);
    if (range !== undefined) headers.set("range", range);
    let response: Response;
    try {
      response = await this.fetcher(video.videoUrl, {
        headers,
        signal: AbortSignal.timeout(this.timeoutMs),
      });
    } catch {
      throw new MiwayomiPlaybackError("The video host could not be reached.");
    }
    if (!response.ok && response.status !== 206)
      throw new MiwayomiPlaybackError(
        `The video host returned HTTP ${response.status}.`,
        response.status,
      );

    const outputHeaders = new Headers();
    for (const name of [
      "accept-ranges",
      "content-length",
      "content-range",
      "content-type",
      "etag",
      "last-modified",
    ]) {
      const value = response.headers.get(name);
      if (value !== null) outputHeaders.set(name, value);
    }
    return new Response(response.body, {
      headers: outputHeaders,
      status: response.status,
    });
  }

  private async getVideos(sourceId: string, episodeUrl: string) {
    return runtimeVideosSchema.parse(
      await this.get(`/anime/${encodeURIComponent(sourceId)}/videos`, {
        url: episodeUrl,
      }),
    );
  }

  private async get(path: string, query?: Record<string, string>) {
    const url = new URL(`/api/v1${path}`, `${this.baseUrl}/`);
    for (const [key, value] of Object.entries(query ?? {}))
      url.searchParams.set(key, value);
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);
    try {
      const response = await this.fetcher(url, {
        headers: { accept: "application/json" },
        signal: controller.signal,
      });
      if (!response.ok)
        throw new MiwayomiClientError(
          `Miwayomi returned HTTP ${response.status}.`,
          response.status,
        );
      try {
        return await response.json();
      } catch {
        throw new MiwayomiClientError("Miwayomi returned invalid JSON.");
      }
    } catch (error) {
      if (controller.signal.aborted)
        throw new MiwayomiClientTimeoutError(
          `Miwayomi request exceeded ${this.timeoutMs}ms.`,
        );
      if (error instanceof MiwayomiClientError) throw error;
      throw new MiwayomiClientError("Miwayomi request failed.");
    } finally {
      clearTimeout(timer);
    }
  }
}

function mapAnimeSummary(
  anime: z.infer<typeof runtimeAnimeSchema>,
  sourceId: string,
) {
  return {
    coverUrl: anime.thumbnail_url ?? undefined,
    description: anime.description ?? undefined,
    source: { externalId: anime.url, sourceId },
    tags: splitTags(anime.genre),
    title: anime.title,
  };
}

function mapTrack(track: z.infer<typeof runtimeTrackSchema>) {
  return { label: track.lang, url: track.url };
}

function asList(value: string | null | undefined) {
  return value === null || value === undefined || value.trim() === ""
    ? []
    : [value];
}

function splitTags(value: string | null | undefined) {
  return value === null || value === undefined
    ? []
    : value
        .split(",")
        .map((tag) => tag.trim())
        .filter(Boolean);
}

function normalizeLanguage(value: string) {
  const language = value.trim().replace(/_/g, "-").toLowerCase();
  if (language === "pt" || language === "pt-br" || language === "por")
    return "pt-BR";
  if (language === "en-us" || language === "en-gb" || language === "eng")
    return "en";
  return language;
}

function normalizeStatus(value: number): "ongoing" | "completed" | "unknown" {
  return value === 1 ? "ongoing" : value === 2 ? "completed" : "unknown";
}
