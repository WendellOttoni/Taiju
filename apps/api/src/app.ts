import { Hono } from "hono";
import { jsonError } from "./http/errors";

export const app = new Hono();

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
  context.json({
    status: "ok",
    service: "taiju-api",
  }),
);

app.notFound((context) =>
  jsonError(context, 404, "not_found", "The requested resource was not found."),
);

app.onError((error, context) => {
  console.error(error);

  return jsonError(
    context,
    500,
    "internal_error",
    "An unexpected error occurred.",
  );
});
