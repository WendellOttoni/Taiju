import type {
  AuthenticatedUser,
  SourceMangaSummary,
  SourceSearchResponse,
  SourceSummary,
} from "@taiju/contracts";
import {
  authCredentialsSchema,
  chapterFeedQuerySchema,
  mangaSearchQuerySchema,
  readerChapterSchema,
  readingProgressSchema,
  sourceDiscoveryQuerySchema,
  sourcePreferencesSchema,
  sourceReadingProgressSchema,
  sourceSearchQuerySchema,
} from "@taiju/contracts";
import type {
  HistoryRepository,
  LibraryRepository,
  RuntimeValidationRepository,
  SourcePreferencesRepository,
} from "@taiju/database";
import {
  getChapterFeed,
  getMangaDetails,
  MangaDexClient,
  MangaDexContentUnavailableError,
  MangaDexHttpError,
  resolveChapterPages,
  searchManga,
} from "@taiju/providers";
import {
  type ReadingSource,
  type SourceDirectory,
  SuwayomiClientError,
  SuwayomiContentUnavailableError,
  validateReadingSource,
} from "@taiju/sources";
import { type Context, Hono } from "hono";
import {
  AuthenticationError,
  type AuthService,
  bearerToken,
  EmailAlreadyRegisteredError,
} from "./auth";
import { jsonError } from "./http/errors";

export type ApiDependencies = {
  adultContentEmails?: readonly string[];
  auth?: AuthService;
  history?: HistoryRepository;
  library?: LibraryRepository;
  mangaDexClient?: Pick<MangaDexClient, "request">;
  sources?: SourceDirectory;
  validationRepository?: RuntimeValidationRepository;
  sourcePreferences?: SourcePreferencesRepository;
};

export function createApp(dependencies: ApiDependencies = {}) {
  const mangaDexClient = dependencies.mangaDexClient ?? new MangaDexClient();
  const adultContentEmails = new Set(
    (dependencies.adultContentEmails ?? []).map((email) =>
      email.trim().toLowerCase(),
    ),
  );
  const auth = dependencies.auth;
  const library = dependencies.library;
  const history = dependencies.history;
  const sources = dependencies.sources;
  const validationRepository = dependencies.validationRepository;
  const sourcePreferences = dependencies.sourcePreferences;
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
  app.get("/api/source-preferences", async (context) => {
    const user = await authenticatedUser(context, auth);
    if (user instanceof Response) return user;
    if (sourcePreferences === undefined)
      return jsonError(
        context,
        503,
        "authentication_unavailable",
        "Source preferences are not configured.",
      );
    const preferences = await sourcePreferences.get(user.id);
    return context.json({
      preferredLanguages: preferences?.preferredLanguages ?? ["pt-BR", "en"],
      enabledSourceIds: preferences?.enabledSourceIds ?? [],
    });
  });
  app.put("/api/source-preferences", async (context) => {
    const user = await authenticatedUser(context, auth);
    if (user instanceof Response) return user;
    if (sourcePreferences === undefined)
      return jsonError(
        context,
        503,
        "authentication_unavailable",
        "Source preferences are not configured.",
      );
    const parsed = sourcePreferencesSchema.safeParse(await context.req.json());
    if (!parsed.success)
      return jsonError(
        context,
        400,
        "validation_error",
        "Invalid source preferences.",
      );
    const saved = await sourcePreferences.save(user.id, parsed.data);
    return context.json({
      preferredLanguages: saved.preferredLanguages,
      enabledSourceIds: saved.enabledSourceIds,
    });
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
  app.get("/api/source-library", async (context) => {
    const user = await authenticatedUser(context, auth);
    if (user instanceof Response) return user;
    if (library === undefined)
      return jsonError(
        context,
        503,
        "authentication_unavailable",
        "Persistence is not configured.",
      );
    const items = await filterStoredSourceItems(
      await library.list(user.id),
      (item) => [item.mangaProvider],
      sources,
      user,
      adultContentEmails,
    );
    return context.json({
      items: items.map((item) => ({
        createdAt: item.createdAt.toISOString(),
        manga: {
          externalId: item.mangaProviderId,
          sourceId: item.mangaProvider,
        },
      })),
    });
  });
  app.put("/api/source-library/:sourceId/:externalId", async (context) => {
    const user = await authenticatedUser(context, auth);
    if (user instanceof Response) return user;
    if (library === undefined)
      return jsonError(
        context,
        503,
        "authentication_unavailable",
        "Persistence is not configured.",
      );
    const manga = {
      externalId: context.req.param("externalId"),
      sourceId: context.req.param("sourceId"),
    };
    if (!validSourceRef(manga))
      return jsonError(
        context,
        400,
        "validation_error",
        "Invalid manga source.",
      );
    const denied = await restrictedSourceResponse(
      context,
      sources,
      manga.sourceId,
      user,
      adultContentEmails,
    );
    if (denied !== undefined) return denied;
    await library.add(user.id, manga.sourceId, manga.externalId);
    return context.body(null, 204);
  });
  app.delete("/api/source-library/:sourceId/:externalId", async (context) => {
    const user = await authenticatedUser(context, auth);
    if (user instanceof Response) return user;
    if (library === undefined)
      return jsonError(
        context,
        503,
        "authentication_unavailable",
        "Persistence is not configured.",
      );
    const manga = {
      externalId: context.req.param("externalId"),
      sourceId: context.req.param("sourceId"),
    };
    if (!validSourceRef(manga))
      return jsonError(
        context,
        400,
        "validation_error",
        "Invalid manga source.",
      );
    const denied = await restrictedSourceResponse(
      context,
      sources,
      manga.sourceId,
      user,
      adultContentEmails,
    );
    if (denied !== undefined) return denied;
    await library.remove(user.id, manga.sourceId, manga.externalId);
    return context.body(null, 204);
  });
  app.get("/api/source-reading-history", async (context) => {
    const user = await authenticatedUser(context, auth);
    if (user instanceof Response) return user;
    if (history === undefined)
      return jsonError(
        context,
        503,
        "authentication_unavailable",
        "Persistence is not configured.",
      );
    const items = await filterStoredSourceItems(
      await history.list(user.id),
      (item) => [item.mangaProvider, item.chapterProvider],
      sources,
      user,
      adultContentEmails,
    );
    return context.json({
      items: items.map((item) => ({
        chapter: {
          externalId: item.chapterProviderId,
          sourceId: item.chapterProvider,
        },
        manga: {
          externalId: item.mangaProviderId,
          sourceId: item.mangaProvider,
        },
        page: Number(item.page),
        updatedAt: item.updatedAt.toISOString(),
      })),
    });
  });
  app.put("/api/source-reading-progress", async (context) => {
    const user = await authenticatedUser(context, auth);
    if (user instanceof Response) return user;
    if (history === undefined)
      return jsonError(
        context,
        503,
        "authentication_unavailable",
        "Persistence is not configured.",
      );
    const parsed = sourceReadingProgressSchema.safeParse(
      await context.req.json(),
    );
    if (!parsed.success)
      return jsonError(
        context,
        400,
        "validation_error",
        "Invalid reading progress.",
      );
    const denied =
      (await restrictedSourceResponse(
        context,
        sources,
        parsed.data.manga.sourceId,
        user,
        adultContentEmails,
      )) ??
      (await restrictedSourceResponse(
        context,
        sources,
        parsed.data.chapter.sourceId,
        user,
        adultContentEmails,
      ));
    if (denied !== undefined) return denied;
    await history.save(user.id, {
      chapterProvider: parsed.data.chapter.sourceId,
      chapterProviderId: parsed.data.chapter.externalId,
      mangaProvider: parsed.data.manga.sourceId,
      mangaProviderId: parsed.data.manga.externalId,
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
      const selectedSources = await resolveSourcesForSearch(
        context,
        sources,
        auth,
        adultContentEmails,
      );
      if (selectedSources instanceof Response) return selectedSources;
      const page = Math.floor(parsed.data.offset / parsed.data.limit) + 1;
      const searches = await mapWithConcurrency(selectedSources, 3, (source) =>
        source.search({ page, query: parsed.data.query }),
      );
      const fulfilled = searches.filter(
        (
          result,
        ): result is PromiseFulfilledResult<
          Awaited<ReturnType<ReadingSource["search"]>>
        > => result.status === "fulfilled",
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
        items: groupSourceSearchItems(
          fulfilled.flatMap((result) => result.value.items),
        ),
      });
    }
    const source = await resolveSource(
      context,
      sources,
      sourceId,
      auth,
      adultContentEmails,
    );
    if (source instanceof Response) return source;
    return context.json(
      await source.search({
        page: Math.floor(parsed.data.offset / parsed.data.limit) + 1,
        query: parsed.data.query,
      }),
    );
  });
  app.get("/api/manga/discover", async (context) => {
    const parsed = sourceDiscoveryQuerySchema.safeParse({
      kind: context.req.query("kind"),
      page:
        context.req.query("page") === undefined
          ? undefined
          : Number(context.req.query("page")),
    });
    if (!parsed.success)
      return jsonError(
        context,
        400,
        "validation_error",
        "Invalid source discovery query.",
      );
    const sourceId = context.req.query("source")?.trim() ?? "all";
    if (sourceId === "all") {
      const selectedSources = await resolveSourcesForSearch(
        context,
        sources,
        auth,
        adultContentEmails,
      );
      if (selectedSources instanceof Response) return selectedSources;
      const discoverableSources = selectedSources.filter(
        (source) => source.discover !== undefined,
      );
      const results = await mapWithConcurrency(
        discoverableSources,
        2,
        (source) =>
          source.discover?.(parsed.data) ??
          Promise.reject(new Error("Source discovery is unavailable.")),
      );
      const fulfilled = results.filter(
        (result): result is PromiseFulfilledResult<SourceSearchResponse> =>
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
        failedSourceIds: results.flatMap((result, index) =>
          result.status === "rejected" &&
          discoverableSources[index] !== undefined
            ? [discoverableSources[index].descriptor.id]
            : [],
        ),
        hasNextPage: fulfilled.some((result) => result.value.hasNextPage),
        items: groupSourceSearchItems(
          fulfilled.flatMap((result) => result.value.items.slice(0, 20)),
        ),
      });
    }
    const source = await resolveSource(
      context,
      sources,
      sourceId,
      auth,
      adultContentEmails,
    );
    if (source instanceof Response) return source;
    if (source.discover === undefined)
      return jsonError(
        context,
        503,
        "source_runtime_unavailable",
        "The selected source does not support discovery.",
      );
    return context.json(await source.discover(parsed.data));
  });
  app.get("/api/sources", async (context) => {
    if (sources === undefined)
      return jsonError(
        context,
        503,
        "source_runtime_unavailable",
        "The source runtime is not configured.",
      );
    const languages = (context.req.queries("language") ?? []).filter(
      (language) => language.trim() !== "",
    );
    try {
      let preferredLanguages: string[] | undefined;
      let enabledSourceIds: string[] | undefined;
      const user = await optionalAuthenticatedUser(context, auth);
      if (user !== undefined && sourcePreferences !== undefined) {
        const preferences = await sourcePreferences.get(user.id);
        preferredLanguages = preferences?.preferredLanguages;
        enabledSourceIds = preferences?.enabledSourceIds;
      }
      const listed = (
        await sources.list(languages.length === 0 ? undefined : languages)
      ).filter((source) =>
        sourceIsAccessible(source, user, adultContentEmails),
      );
      const ordered = [...listed].sort((left, right) => {
        const leftLanguage = preferredLanguages?.indexOf(left.language) ?? -1;
        const rightLanguage = preferredLanguages?.indexOf(right.language) ?? -1;
        return (
          (leftLanguage < 0 ? 999 : leftLanguage) -
          (rightLanguage < 0 ? 999 : rightLanguage)
        );
      });
      return context.json({
        items:
          enabledSourceIds && enabledSourceIds.length > 0
            ? ordered.filter((source) => enabledSourceIds.includes(source.id))
            : ordered,
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
  app.get("/api/sources/validate", async (context) => {
    if (sources === undefined)
      return jsonError(
        context,
        503,
        "source_runtime_unavailable",
        "The source runtime is not configured.",
      );
    const parsed = sourceSearchQuerySchema.safeParse({
      query: context.req.query("q"),
      page: 1,
    });
    if (!parsed.success)
      return jsonError(
        context,
        400,
        "validation_error",
        "Invalid source validation query.",
      );
    const selectedId = context.req.query("source")?.trim();
    try {
      const user = await optionalAuthenticatedUser(context, auth);
      const descriptors = (
        selectedId
          ? (await sources.list()).filter(
              (descriptor) => descriptor.id === selectedId,
            )
          : await sources.list(["pt-BR", "en"])
      ).filter((source) =>
        sourceIsAccessible(source, user, adultContentEmails),
      );
      if (descriptors.length === 0)
        return jsonError(
          context,
          404,
          "not_found",
          "The requested source was not found.",
        );
      const resolved = await mapWithConcurrency(
        descriptors,
        3,
        async (descriptor) => {
          const source = await sources.get(descriptor.id);
          if (source === undefined)
            throw new Error("Source is no longer available.");
          return validateReadingSource(source, { query: parsed.data.query });
        },
      );
      const items = resolved.flatMap((result) =>
        result.status === "fulfilled" ? [result.value] : [],
      );
      if (validationRepository !== undefined)
        await Promise.all(
          items.map((item) =>
            validationRepository.save({
              passed: item.passed,
              query: parsed.data.query,
              report: item,
              sourceId: item.sourceId,
            }),
          ),
        );
      return context.json({
        failedSourceIds: resolved.flatMap((result, index) =>
          result.status === "rejected" && descriptors[index] !== undefined
            ? [descriptors[index].id]
            : [],
        ),
        items,
      });
    } catch (error) {
      console.error(
        JSON.stringify({
          errorName: error instanceof Error ? error.name : "UnknownError",
          event: "source_validation_error",
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
  app.get("/api/sources/validations", async (context) => {
    if (validationRepository === undefined)
      return jsonError(
        context,
        503,
        "source_runtime_unavailable",
        "Validation persistence is not configured.",
      );
    const sourceId = context.req.query("source")?.trim() || undefined;
    const rawLimit = context.req.query("limit");
    const limit = rawLimit === undefined ? undefined : Number(rawLimit);
    if (
      limit !== undefined &&
      (!Number.isInteger(limit) || limit < 1 || limit > 200)
    )
      return jsonError(
        context,
        400,
        "validation_error",
        "Invalid validation limit.",
      );
    try {
      const user = await optionalAuthenticatedUser(context, auth);
      const restrictedSourceIds = await listRestrictedSourceIds(sources);
      if (
        sourceId !== undefined &&
        restrictedSourceIds.has(sourceId) &&
        !userCanAccessAdultContent(user, adultContentEmails)
      )
        return sourceNotFound(context);
      const items = (await validationRepository.list(sourceId, limit)).filter(
        (item) =>
          !restrictedSourceIds.has(item.sourceId) ||
          userCanAccessAdultContent(user, adultContentEmails),
      );
      return context.json({
        items: items.map((item) => ({
          ...item,
          checkedAt: item.checkedAt.toISOString(),
        })),
      });
    } catch (error) {
      console.error(
        JSON.stringify({
          errorName: error instanceof Error ? error.name : "UnknownError",
          event: "source_validation_history_error",
          message: error instanceof Error ? error.message : "Unknown error",
        }),
      );
      return jsonError(
        context,
        503,
        "source_runtime_unavailable",
        "Validation persistence is unavailable.",
      );
    }
  });
  app.get("/api/manga/:provider/:id/alternatives", async (context) => {
    const provider = context.req.param("provider");
    if (provider === "mangadex")
      return jsonError(
        context,
        400,
        "validation_error",
        "Alternative sources require a dynamic source reference.",
      );
    const current = await resolveSource(
      context,
      sources,
      provider,
      auth,
      adultContentEmails,
    );
    if (current instanceof Response) return current;
    if (sources === undefined)
      return jsonError(
        context,
        503,
        "source_runtime_unavailable",
        "The source runtime is not configured.",
      );
    try {
      const details = await current.details(context.req.param("id"));
      const user = await optionalAuthenticatedUser(context, auth);
      const candidates = (
        await sources.list([current.descriptor.language])
      ).filter((source) =>
        sourceIsAccessible(source, user, adultContentEmails),
      );
      const resolved = await mapWithConcurrency(
        candidates.filter((candidate) => candidate.id !== provider),
        3,
        async (candidate) => {
          const source = await sources.get(candidate.id);
          if (!source) throw new Error("Source unavailable.");
          const search = await source.search({ query: details.title, page: 1 });
          return search.items.filter((item) =>
            equivalentTitle(item.title, details.title),
          );
        },
      );
      return context.json({
        items: resolved.flatMap((result) =>
          result.status === "fulfilled" ? result.value : [],
        ),
      });
    } catch (error) {
      console.error(
        JSON.stringify({
          errorName: error instanceof Error ? error.name : "UnknownError",
          event: "source_alternatives_error",
          message: error instanceof Error ? error.message : "Unknown error",
          sourceId: provider,
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
        auth,
        adultContentEmails,
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
        auth,
        adultContentEmails,
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
        auth,
        adultContentEmails,
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
    if (error instanceof SuwayomiContentUnavailableError)
      return jsonError(
        context,
        404,
        "content_unavailable",
        "This chapter has no readable pages available from the selected source.",
      );
    if (error instanceof MangaDexHttpError)
      return jsonError(
        context,
        503,
        "provider_unavailable",
        "MangaDex is unavailable.",
      );
    if (error instanceof SuwayomiClientError)
      return jsonError(
        context,
        503,
        "source_runtime_unavailable",
        "The selected source is unavailable.",
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
  auth: AuthService | undefined,
  adultContentEmails: ReadonlySet<string>,
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
    if (source !== undefined) {
      const user = await optionalAuthenticatedUser(context, auth);
      if (sourceIsAccessible(source.descriptor, user, adultContentEmails))
        return source;
      return sourceNotFound(context);
    }
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
  auth: AuthService | undefined,
  adultContentEmails: ReadonlySet<string>,
): Promise<ReadingSource[] | Response> {
  if (sources === undefined)
    return jsonError(
      context,
      503,
      "source_runtime_unavailable",
      "The source runtime is not configured.",
    );
  try {
    const user = await optionalAuthenticatedUser(context, auth);
    const descriptors = (await sources.list(["pt-BR", "en"])).filter((source) =>
      sourceIsAccessible(source, user, adultContentEmails),
    );
    const resolved = await Promise.all(
      descriptors.map((descriptor) => sources.get(descriptor.id)),
    );
    return resolved.filter(
      (source): source is ReadingSource => source !== undefined,
    );
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

async function optionalAuthenticatedUser(
  context: Context,
  auth: AuthService | undefined,
): Promise<AuthenticatedUser | undefined> {
  const token = bearerToken(context.req.header("Authorization"));
  if (token === undefined || auth === undefined) return undefined;
  try {
    return await auth.authenticate(token);
  } catch (error) {
    if (error instanceof AuthenticationError) return undefined;
    throw error;
  }
}

function sourceIsAccessible(
  source: SourceSummary,
  user: AuthenticatedUser | undefined,
  adultContentEmails: ReadonlySet<string>,
) {
  return (
    (source.contentRating !== "adult" && source.contentRating !== "mixed") ||
    userCanAccessAdultContent(user, adultContentEmails)
  );
}

function userCanAccessAdultContent(
  user: AuthenticatedUser | undefined,
  adultContentEmails: ReadonlySet<string>,
) {
  return user !== undefined && adultContentEmails.has(user.email.toLowerCase());
}

async function listRestrictedSourceIds(sources: SourceDirectory | undefined) {
  if (sources === undefined) return new Set<string>();
  return new Set(
    (await sources.list())
      .filter(
        (source) =>
          source.contentRating === "adult" || source.contentRating === "mixed",
      )
      .map((source) => source.id),
  );
}

async function restrictedSourceResponse(
  context: Context,
  sources: SourceDirectory | undefined,
  sourceId: string,
  user: AuthenticatedUser,
  adultContentEmails: ReadonlySet<string>,
) {
  if (sourceId === "mangadex" || sources === undefined) return undefined;
  const source = await sources.get(sourceId);
  if (
    source !== undefined &&
    !sourceIsAccessible(source.descriptor, user, adultContentEmails)
  )
    return sourceNotFound(context);
  return undefined;
}

async function filterStoredSourceItems<T>(
  items: T[],
  sourceIds: (item: T) => readonly string[],
  sources: SourceDirectory | undefined,
  user: AuthenticatedUser,
  adultContentEmails: ReadonlySet<string>,
) {
  if (userCanAccessAdultContent(user, adultContentEmails)) return items;
  const restrictedSourceIds = await listRestrictedSourceIds(sources);
  return items.filter((item) =>
    sourceIds(item).every((sourceId) => !restrictedSourceIds.has(sourceId)),
  );
}

function sourceNotFound(context: Context) {
  return jsonError(
    context,
    404,
    "not_found",
    "The requested source was not found.",
  );
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

function equivalentTitle(left: string, right: string): boolean {
  return normalizedTitle(left) === normalizedTitle(right);
}

function groupSourceSearchItems(items: SourceMangaSummary[]) {
  const groups = new Map<
    string,
    {
      coverUrl?: string;
      description?: string;
      items: SourceMangaSummary[];
      key: string;
      tags: string[];
      title: string;
    }
  >();
  for (const item of items) {
    const titleKey = normalizedTitle(item.title);
    const current = groups.get(titleKey);
    if (current === undefined) {
      groups.set(titleKey, {
        coverUrl: item.coverUrl,
        description: item.description,
        items: [item],
        key: titleKey,
        tags: item.tags,
        title: item.title,
      });
      continue;
    }
    if (hasSharedTag(current.tags, item.tags)) {
      current.items.push(item);
      continue;
    }
    groups.set(`${titleKey}:${item.source.sourceId}:${item.source.externalId}`, {
      coverUrl: item.coverUrl,
      description: item.description,
      items: [item],
      key: `${titleKey}:${item.source.sourceId}:${item.source.externalId}`,
      tags: item.tags,
      title: item.title,
    });
  }
  return [...groups.values()];
}

function hasSharedTag(left: string[], right: string[]) {
  const leftTags = new Set(left.map(normalizedTitle));
  return right.some((tag) => leftTags.has(normalizedTitle(tag)));
}

function normalizedTitle(value: string) {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function validSourceRef(value: { externalId: string; sourceId: string }) {
  return (
    value.externalId.trim().length > 0 &&
    value.externalId.length <= 500 &&
    value.sourceId.trim().length > 0 &&
    value.sourceId.length <= 500
  );
}
