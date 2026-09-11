import type { Context } from "hono";

type ApiErrorCode =
  | "authentication_unavailable"
  | "conflict"
  | "content_unavailable"
  | "internal_error"
  | "not_found"
  | "provider_unavailable"
  | "source_runtime_unavailable"
  | "unauthorized"
  | "validation_error";

export function jsonError(
  context: Context,
  status: 400 | 401 | 404 | 409 | 500 | 503,
  code: ApiErrorCode,
  message: string,
) {
  return context.json({ error: { code, message } }, status);
}
