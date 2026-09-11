import type { Context } from "hono";

type ApiErrorCode = "internal_error" | "not_found";

export function jsonError(
  context: Context,
  status: 404 | 500,
  code: ApiErrorCode,
  message: string,
) {
  return context.json({ error: { code, message } }, status);
}
