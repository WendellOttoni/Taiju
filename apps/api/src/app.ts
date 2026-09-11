import {
  authCredentialsSchema,
  chapterFeedQuerySchema,
  mangaSearchQuerySchema,
  readerChapterSchema,
  readingProgressSchema,
} from "@taiju/contracts";
import type { HistoryRepository, LibraryRepository } from "@taiju/database";
import {
  getChapterFeed,
  getMangaDetails,
  MangaDexClient,
  MangaDexContentUnavailableError,
  MangaDexHttpError,
  resolveChapterPages,
  searchManga,
} from "@taiju/providers";
import type { ReadingSource, SourceDirectory } from "@taiju/sources";
import { type Context, Hono } from "hono";
import {
  AuthenticationError,
  type AuthService,
  bearerToken,
  EmailAlreadyRegisteredError,
} from "./auth";
import { jsonError } from "./http/errors";

export type ApiDependencies = {
  auth?: AuthService;
  history?: HistoryRepository;
  library?: LibraryRepository;
  mangaDexClient?: Pick<MangaDexClient, "request">;
  sources?: SourceDirectory;
};

export function createApp(dependencies: ApiDependencies = {}) {
  const mangaDexClient = dependencies.mangaDexClient ?? new MangaDexClient();
  const auth = dependencies.auth;
  const library = dependencies.library;
  const history = dependencies.history;
  const sources = dependencies.sources;
  const app = new Hono();
  app.use("*", async (context, next) => {
    const startedAt = performance.now();
    await next();
    console.info(
      JSON.stringify({
        method: context.req.method,
        path: new URL(context.req.url).pathname,
        status: context.res.status,
        durationMs: Math.round(performance.now() - startedAt),
      }),
    );
  });
  app.get("/health", (context) =>
    context.json({ status: "ok", service: "taiju-api" }),
  );
  app.post("/api/auth/register", async (context) => {
    if (auth === undefined)
      return jsonError(
        context,
        503,
        "authentication_unavailable",
        "Authentication is not configured.",
      );
    const parsed = authCredentialsSchema.safeParse(await context.req.json());
    if (!parsed.success)
      return jsonError(
        context,
        400,
        "validation_error",
        "Invalid authentication credentials.",
      );
    return context.json(
      await auth.register(parsed.data.email, parsed.data.password),
      201,
    );
  });
  app.post("/api/auth/login", async (context) => {
    if (auth === undefined)
      return jsonError(
        context,
        503,
        "authentication_unavailable",
        "Authentication is not configured.",
      );
    const parsed = authCredentialsSchema.safeParse(await context.req.json());
    if (!parsed.success)
      return jsonError(
        context,
        400,
        "validation_error",
        "Invalid authentication credentials.",
      );
    return context.json(
      await auth.login(parsed.data.email, parsed.data.password),
    );
  });
  app.get("/api/auth/me", async (context) => {
    if (auth === undefined)
      return jsonError(
        context,
        503,
        "authentication_unavailable",
        "Authentication is not configured.",
      );
    const token = bearerToken(context.req.header("Authorization"));
    if (token === undefined)
      return jsonError(
        context,
        401,
        "unauthorized",
        "Authentication is required.",
      );
    return context.json(await auth.authenticate(token));
  });
  app.get("/api/library", async (context) => {
    const user = await authenticatedUser(context, auth);
    if (user instanceof Response) return user;
    if (library === undefined)
      return jsonError(
        context,
        503,
        "authentication_unavailable",
        "Persistence is not configured.",
      );
    const items = await library.list(user.id);
    return context.json({
      items: items.map((item) => ({
        ...item,
        createdAt: item.createdAt.toISOString(),
        mangaProvider: "mangadex" as const,
      })),
    });
  });
  app.put("/api/library/manga/:provider/:id", async (context) => {
    const user = await authenticatedUser(context, auth);
    if (user instanceof Response) return user;
    if (library === undefined)
      return jsonError(
        context,
        503,
        "authentication_unavailable",
        "Persistence is not configured.",
      );
    if (
      context.req.param("provider") !== "mangadex" ||
      !isUuid(context.req.param("id"))
    )
      return jsonError(
        context,
        400,
        "validation_error",
        "Invalid manga identifier.",
      );
    await library.add(user.id, "mangadex", context.req.param("id"));
    return context.body(null, 204);
  });
  app.delete("/api/library/manga/:provider/:id", async (context) => {
    const user = await authenticatedUser(context, auth);
    if (user instanceof Response) return user;
    if (library === undefined)
      return jsonError(
        context,
        503,
        "authentication_unavailable",
        "Persistence is not configured.",
      );
    if (
      context.req.param("provider") !== "mangadex" ||
      !isUuid(context.req.param("id"))
    )
      return jsonError(
        context,
        400,
        "validation_error",
        "Invalid manga identifier.",
      );
    await library.remove(user.id, "mangadex", context.req.param("id"));
    return context.body(null, 204);
  });
  app.get("/api/reading-history", async (context) => {
    const user = await authenticatedUser(context, auth);
    if (user instanceof Response) return user;
    if (history === undefined)
      return jsonError(
        context,
        503,
        "authentication_unavailable",
        "Persistence is not configured.",
      );
    const items = await history.list(user.id);
    return context.json({
      items: items.map((item) => ({
        ...item,
        chapterProvider: "mangadex" as const,
        mangaProvider: "mangadex" as const,
        page: Number(item.page),
        updatedAt: item.updatedAt.toISOString(),
      })),
    });
  });
  app.put("/api/reading-progress", async (context) => {
    const user = await authenticatedUser(context, auth);
    if (user instanceof Response) return user;
    if (history === undefined)
      return jsonError(
        context,
        503,
        "authentication_unavailable",
        "Persistence is not configured.",
      );
    const parsed = readingProgressSchema.safeParse(await context.req.json());
    if (!parsed.success)
      return jsonError(
        context,
        400,
        "validation_error",
        "Invalid reading progress.",
      );
    await history.save(user.id, {
      chapterProvider: parsed.data.chapterProvider,
      chapterProviderId: parsed.data.chapterProviderId,
      mangaProvider: parsed.data.mangaProvider,
      mangaProviderId: parsed.data.mangaProviderId,
      page: String(parsed.data.page),
    });
    return context.body(null, 204);
  });
  app.get("/api/manga/search", async (context) => {
    const parsed = mangaSearchQuerySchema.safeParse({
      query: context.req.query("q"),
      limit:
        context.req.query("limit") === undefined
          ? undefined
          : Number(context.req.query("limit")),
      offset:
        context.req.query("offset") === undefined
          ? undefined
          : Number(context.req.query("offset")),
    });
    if (!parsed.success)
      return jsonError(
        context,
        400,
        "validation_error",
        "Invalid manga search query.",
      );
    const sourceId = context.req.query("source")?.trim();
    if (sourceId === undefined || sourceId === "")
      return context.json(await searchManga(mangaDexClient, parsed.data));
    if (sourceId === "all") {
      const selectedSources = await resolveSourcesForSearch(context, sources);
      if (selectedSources instanceof Response) return selectedSources;
      const page = Math.floor(parsed.data.offset / parsed.data.limit) + 1;
      const searches = await mapWithConcurrency(selectedSources, 3, (source) =>
        source.search({ page, query: parsed.data.query }),
      );
      const fulfilled = searches.filter(
        (result): result is PromiseFulfilledResult<Awaited<ReturnType<ReadingSource["search"]>>> =>
          result.status === "fulfilled",
      );
      if (fulfilled.length === 0)
        return jsonError(
          context,
          503,
          "source_runtime_unavailable",
          "No selected source is available.",
        );
      return context.json({
        failedSourceIds: searches.flatMap((result, index) =>
          result.status === "rejected" && selectedSources[index] !== undefined
            ? [selectedSources[index].descriptor.id]
            : [],
        ),
        hasNextPage: fulfilled.some((result) => result.value.hasNextPage),
        items: fulfilled.flatMap((result) => result.value.items),
      });
    }
    const source = await resolveSource(context, sources, sourceId);
    if (source instanceof Response) return source;
    return context.json(
      await source.search({ page: Math.floor(parsed.data.offset / parsed.data.limit) + 1, query: parsed.data.query }),
    );
  });
  app.get("/api/sources", async (context) => {
    if (sources === undefined)
      return jsonError(
        context,
        503,
        "source_runtime_unavailable",
        "The source runtime is not configured.",
      );
    const languages = (context.req
      .queries("language") ?? [])
      .filter((language) => language.trim() !== "");
    try {
      return context.json({
        items: await sources.list(languages.length === 0 ? undefined : languages),
      });
    } catch (error) {
      console.error(
        JSON.stringify({
          errorName: error instanceof Error ? error.name : "UnknownError",
          event: "source_list_error",
          message: error instanceof Error ? error.message : "Unknown error",
        }),
      );
      return jsonError(
        context,
        503,
        "source_runtime_unavailable",
        "The source runtime is unavailable.",
      );
    }
  });
  app.get("/api/manga/:provider/:id", async (context) => {
    if (context.req.param("provider") !== "mangadex") {
      const source = await resolveSource(
        context,
        sources,
        context.req.param("provider"),
      );
      if (source instanceof Response) return source;
      return context.json(await source.details(context.req.param("id")));
    }
    const id = context.req.param("id");
    if (
      !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
        id,
      )
    )
      return jsonError(
        context,
        400,
        "validation_error",
        "Invalid manga identifier.",
      );
    return context.json(await getMangaDetails(mangaDexClient, id));
  });
  app.get("/api/manga/:provider/:id/chapters", async (context) => {
    if (context.req.param("provider") !== "mangadex") {
      const source = await resolveSource(
        context,
        sources,
        context.req.param("provider"),
      );
      if (source instanceof Response) return source;
      return context.json(await source.chapters(context.req.param("id")));
    }
    const id = context.req.param("id");
    if (
      !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
        id,
      )
    )
      return jsonError(
        context,
        400,
        "validation_error",
        "Invalid manga identifier.",
      );
    const query = chapterFeedQuerySchema.safeParse({
      language: context.req.query("language"),
      limit:
        context.req.query("limit") === undefined
          ? undefined
          : Number(context.req.query("limit")),
      offset:
        context.req.query("offset") === undefined
          ? undefined
          : Number(context.req.query("offset")),
    });
    if (!query.success)
      return jsonError(
        context,
        400,
        "validation_error",
        "Invalid chapter feed query.",
      );
    return context.json(
      await getChapterFeed(mangaDexClient, id, {
        languages:
          query.data.language === undefined ? undefined : [query.data.language],
        limit: query.data.limit,
        offset: query.data.offset,
      }),
    );
  });
  app.get("/api/chapters/:provider/:id/pages", async (context) => {
    if (context.req.param("provider") !== "mangadex") {
      const source = await resolveSource(
        context,
        sources,
        context.req.param("provider"),
      );
      if (source instanceof Response) return source;
      return context.json(await source.pages(context.req.param("id")));
    }
    const id = context.req.param("id");
    if (
      !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
        id,
      )
    )
      return jsonError(
        context,
        400,
        "validation_error",
        "Invalid chapter identifier.",
      );
    const pages = await resolveChapterPages(mangaDexClient, id);
    return context.json(
      readerChapterSchema.parse({
        provider: "mangadex",
        providerId: pages.chapterId,
        pageUrls: pages.pages,
      }),
    );
  });
  app.notFound((context) =>
    jsonError(
      context,
      404,
      "not_found",
      "The requested resource was not found.",
    ),
  );
  app.onError((error, context) => {
    console.error(
      JSON.stringify({
        errorName: error instanceof Error ? error.name : "UnknownError",
        event: "api_error",
        message: error instanceof Error ? error.message : "Unknown error",
        method: context.req.method,
        path: new URL(context.req.url).pathname,
      }),
    );
    if (error instanceof MangaDexContentUnavailableError)
      return jsonError(
        context,
        404,
        "content_unavailable",
        "This chapter has no readable pages available from MangaDex.",
      );
    if (error instanceof MangaDexHttpError)
      return jsonError(
        context,
        503,
        "provider_unavailable",
        "MangaDex is unavailable.",
      );
    if (error instanceof AuthenticationError)
      return jsonError(context, 401, "unauthorized", error.message);
    if (error instanceof EmailAlreadyRegisteredError)
      return jsonError(context, 409, "conflict", error.message);
    return jsonError(
      context,
      500,
      "internal_error",
      "An unexpected error occurred.",
    );
  });
  return app;
}

export const app = createApp();

async function authenticatedUser(
  context: Context,
  auth: AuthService | undefined,
) {
  if (auth === undefined)
    return jsonError(
      context,
      503,
      "authentication_unavailable",
      "Authentication is not configured.",
    );
  const token = bearerToken(context.req.header("Authorization"));
  if (token === undefined)
    return jsonError(
      context,
      401,
      "unauthorized",
      "Authentication is required.",
    );
  return auth.authenticate(token);
}

async function resolveSource(
  context: Context,
  sources: SourceDirectory | undefined,
  sourceId: string,
): Promise<ReadingSource | Response> {
  if (sources === undefined)
    return jsonError(
      context,
      503,
      "source_runtime_unavailable",
      "The source runtime is not configured.",
    );
  try {
    const source = await sources.get(sourceId);
    if (source !== undefined) return source;
  } catch (error) {
    console.error(
      JSON.stringify({
        errorName: error instanceof Error ? error.name : "UnknownError",
        event: "source_resolve_error",
        message: error instanceof Error ? error.message : "Unknown error",
        sourceId,
      }),
    );
    return jsonError(
      context,
      503,
      "source_runtime_unavailable",
      "The source runtime is unavailable.",
    );
  }
  return jsonError(
    context,
    404,
    "not_found",
    "The requested source was not found.",
  );
}

async function resolveSourcesForSearch(
  context: Context,
  sources: SourceDirectory | undefined,
): Promise<ReadingSource[] | Response> {
  if (sources === undefined)
    return jsonError(
      context,
      503,
      "source_runtime_unavailable",
      "The source runtime is not configured.",
    );
  try {
    const descriptors = await sources.list(["pt-BR", "en"]);
    const resolved = await Promise.all(
      descriptors.map((descriptor) => sources.get(descriptor.id)),
    );
    return resolved.filter((source): source is ReadingSource => source !== undefined);
  } catch (error) {
    console.error(
      JSON.stringify({
        errorName: error instanceof Error ? error.name : "UnknownError",
        event: "source_search_resolve_error",
        message: error instanceof Error ? error.message : "Unknown error",
      }),
    );
    return jsonError(
      context,
      503,
      "source_runtime_unavailable",
      "The source runtime is unavailable.",
    );
  }
}

async function mapWithConcurrency<T, R>(
  values: T[],
  limit: number,
  operation: (value: T) => Promise<R>,
): Promise<PromiseSettledResult<R>[]> {
  const results: PromiseSettledResult<R>[] = [];
  for (let index = 0; index < values.length; index += limit) {
    const batch = values.slice(index, index + limit);
    results.push(...(await Promise.allSettled(batch.map(operation))));
  }
  return results;
}

function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value,
  );
}
