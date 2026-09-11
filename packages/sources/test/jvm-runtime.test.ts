import { describe, expect, test } from "bun:test";
import {
  decodeRuntimeResponse,
  encodeRuntimeRequest,
  JvmSourceRuntime,
  SourceRuntimeTimeoutError,
} from "../src";

describe("JVM runtime IPC boundary", () => {
  test("encodes requests and executes normalized operations", async () => {
    let request = "";
    const runtime = new JvmSourceRuntime({
      spawn: async () => ({
        write: async (line) => {
          request = line;
        },
        readLine: async () =>
          JSON.stringify({
            id: "req-1",
            ok: true,
            result: [{ title: "Example" }],
          }),
        kill: () => undefined,
      }),
      idFactory: () => "req-1",
    });
    await expect(
      runtime.execute("search", "source-1", { query: "example" }),
    ).resolves.toEqual([{ title: "Example" }]);
    expect(JSON.parse(request)).toMatchObject({
      operation: "search",
      sourceId: "source-1",
    });
  });
  test("stops and reports timeout", async () => {
    let killed = false;
    const runtime = new JvmSourceRuntime({
      timeoutMs: 5,
      spawn: async () => ({
        write: async () => undefined,
        readLine: async (signal) =>
          await new Promise<string>((_, reject) =>
            signal.addEventListener(
              "abort",
              () => reject(new Error("aborted")),
              { once: true },
            ),
          ),
        kill: () => {
          killed = true;
        },
      }),
    });
    await expect(runtime.execute("details", "source-1")).rejects.toBeInstanceOf(
      SourceRuntimeTimeoutError,
    );
    expect(killed).toBe(true);
  });
  test("rejects mismatched protocol responses", () => {
    expect(() => decodeRuntimeResponse("{}", "expected")).toThrow();
    expect(
      encodeRuntimeRequest({
        id: "1",
        operation: "pages",
        sourceId: "s",
        payload: {},
      }),
    ).toEndWith("\n");
  });
});
