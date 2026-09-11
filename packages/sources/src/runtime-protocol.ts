export const runtimeOperations = [
  "search",
  "details",
  "chapters",
  "pages",
] as const;
export type RuntimeOperation = (typeof runtimeOperations)[number];
export type RuntimeRequest = {
  id: string;
  operation: RuntimeOperation;
  sourceId: string;
  payload: Record<string, unknown>;
};
export type RuntimeResponse = {
  id: string;
  ok: boolean;
  result?: unknown;
  error?: { code: string; message: string };
};

export class SourceRuntimeProtocolError extends Error {
  override name = "SourceRuntimeProtocolError";
}
export function encodeRuntimeRequest(request: RuntimeRequest) {
  return `${JSON.stringify(request)}\n`;
}
export function decodeRuntimeResponse(
  line: string,
  requestId: string,
): RuntimeResponse {
  let value: unknown;
  try {
    value = JSON.parse(line);
  } catch {
    throw new SourceRuntimeProtocolError("Runtime returned invalid JSON.");
  }
  if (!value || typeof value !== "object")
    throw new SourceRuntimeProtocolError(
      "Runtime returned an invalid response.",
    );
  const response = value as Partial<RuntimeResponse>;
  if (response.id !== requestId || typeof response.ok !== "boolean")
    throw new SourceRuntimeProtocolError(
      "Runtime response does not match the request.",
    );
  if (
    !response.ok &&
    (!response.error ||
      typeof response.error.code !== "string" ||
      typeof response.error.message !== "string")
  )
    throw new SourceRuntimeProtocolError("Runtime returned an invalid error.");
  return response as RuntimeResponse;
}
