import type { Context } from "hono";

type ApiErrorCode =
  | "internal_error"
  | "not_found"
  | "provider_unavailable"
  | "validation_error";

export function jsonError(
  context: Context,
  status: 400 | 404 | 500 | 503,
  code: ApiErrorCode,
  message: string,
) {
  return context.json({ error: { code, message } }, status);
}
