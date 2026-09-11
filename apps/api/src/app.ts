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
};

export function createApp(dependencies: ApiDependencies = {}) {
  const mangaDexClient = dependencies.mangaDexClient ?? new MangaDexClient();
  const auth = dependencies.auth;
  const library = dependencies.library;
  const history = dependencies.history;
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
    return context.json(await searchManga(mangaDexClient, parsed.data));
  });
  app.get("/api/manga/:provider/:id", async (context) => {
    if (context.req.param("provider") !== "mangadex")
      return jsonError(
        context,
        404,
        "not_found",
        "The requested resource was not found.",
      );
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
    if (context.req.param("provider") !== "mangadex")
      return jsonError(
        context,
        404,
        "not_found",
        "The requested resource was not found.",
      );
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
    if (context.req.param("provider") !== "mangadex")
      return jsonError(
        context,
        404,
        "not_found",
        "The requested resource was not found.",
      );
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

function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value,
  );
}
