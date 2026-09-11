import { describe, expect, test } from "bun:test";
import {
  SuwayomiClientError,
  SuwayomiClientTimeoutError,
  SuwayomiRuntimeClient,
} from "../src";

describe("Suwayomi runtime client", () => {
  test("uses the isolated GraphQL boundary and maps source metadata", async () => {
    let requested = "";
    const client = new SuwayomiRuntimeClient({
      baseUrl: "http://suwayomi.test",
      fetch: async (input) => {
        requested = String(input);
        return Response.json({
          data: {
            sources: {
              nodes: [
                {
                  id: "1",
                  lang: "en",
                  name: "Example",
                  extension: { pkgName: "example.source", versionName: "1.0" },
                },
              ],
            },
          },
        });
      },
    });
    await expect(client.listSources()).resolves.toEqual([
      {
        id: "1",
        language: "en",
        name: "Example",
        packageName: "example.source",
        version: "1.0",
      },
    ]);
    expect(requested).toBe("http://suwayomi.test/api/graphql");
  });
  test("translates HTTP and timeout failures", async () => {
    const failing = new SuwayomiRuntimeClient({
      baseUrl: "http://suwayomi.test",
      fetch: async () => new Response("", { status: 503 }),
    });
    await expect(failing.listSources()).rejects.toBeInstanceOf(
      SuwayomiClientError,
    );
    const slow = new SuwayomiRuntimeClient({
      baseUrl: "http://suwayomi.test",
      timeoutMs: 5,
      fetch: async (_input, init) =>
        await new Promise<Response>((_, reject) =>
          init?.signal?.addEventListener(
            "abort",
            () => reject(new Error("aborted")),
            { once: true },
          ),
        ),
    });
    await expect(slow.listSources()).rejects.toBeInstanceOf(
      SuwayomiClientTimeoutError,
    );
  });
});
