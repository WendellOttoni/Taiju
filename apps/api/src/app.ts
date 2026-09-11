import { mangaSearchQuerySchema } from "@taiju/contracts";
import {
  getMangaDetails,
  MangaDexClient,
  MangaDexHttpError,
  searchManga,
} from "@taiju/providers";
import { Hono } from "hono";
import { jsonError } from "./http/errors";

export type ApiDependencies = {
  mangaDexClient?: Pick<MangaDexClient, "request">;
};

export function createApp(dependencies: ApiDependencies = {}) {
  const mangaDexClient = dependencies.mangaDexClient ?? new MangaDexClient();
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
  app.notFound((context) =>
    jsonError(
      context,
      404,
      "not_found",
      "The requested resource was not found.",
    ),
  );
  app.onError((error, context) => {
    console.error(error);
    if (error instanceof MangaDexHttpError)
      return jsonError(
        context,
        503,
        "provider_unavailable",
        "MangaDex is unavailable.",
      );
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
