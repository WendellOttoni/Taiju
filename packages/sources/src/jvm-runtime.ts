import type {
  RuntimeOperation,
  RuntimeRequest,
  RuntimeResponse,
} from "./runtime-protocol";
import {
  decodeRuntimeResponse,
  encodeRuntimeRequest,
  SourceRuntimeProtocolError,
} from "./runtime-protocol";

export type RuntimeProcess = {
  write(line: string): Promise<void>;
  readLine(signal: AbortSignal): Promise<string>;
  kill(): void;
};
export type SourceRuntimeOptions = {
  spawn: () => Promise<RuntimeProcess>;
  timeoutMs?: number;
  idFactory?: () => string;
};
export class SourceRuntimeTimeoutError extends Error {
  override name = "SourceRuntimeTimeoutError";
}
export class SourceRuntimeRemoteError extends Error {
  override name = "SourceRuntimeRemoteError";
  constructor(
    message: string,
    readonly code: string,
  ) {
    super(message);
  }
}

const operationSet = new Set<string>([
  "search",
  "details",
  "chapters",
  "pages",
]);
export class JvmSourceRuntime {
  private process?: RuntimeProcess;
  private sequence = 0;
  private readonly timeoutMs: number;
  constructor(private readonly options: SourceRuntimeOptions) {
    this.timeoutMs = options.timeoutMs ?? 15_000;
    if (!Number.isInteger(this.timeoutMs) || this.timeoutMs < 1)
      throw new Error("Source runtime timeout must be a positive integer.");
  }
  async execute<T>(
    operation: RuntimeOperation,
    sourceId: string,
    payload: Record<string, unknown> = {},
  ): Promise<T> {
    if (!operationSet.has(operation))
      throw new SourceRuntimeProtocolError(
        "Unsupported source runtime operation.",
      );
    let process = this.process;
    if (!process) {
      process = await this.options.spawn();
      this.process = process;
    }
    const request: RuntimeRequest = {
      id: this.options.idFactory?.() ?? `taiju-${++this.sequence}`,
      operation,
      sourceId,
      payload,
    };
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);
    try {
      await process.write(encodeRuntimeRequest(request));
      const response: RuntimeResponse = decodeRuntimeResponse(
        await process.readLine(controller.signal),
        request.id,
      );
      if (!response.ok)
        throw new SourceRuntimeRemoteError(
          response.error?.message ?? "Source runtime failed.",
          response.error?.code ?? "runtime_error",
        );
      return response.result as T;
    } catch (error) {
      if (controller.signal.aborted) {
        this.stop();
        throw new SourceRuntimeTimeoutError(
          `Source runtime exceeded ${this.timeoutMs}ms.`,
        );
      }
      throw error;
    } finally {
      clearTimeout(timer);
    }
  }
  stop() {
    this.process?.kill();
    this.process = undefined;
  }
}
