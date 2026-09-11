import { describe, expect, test } from "bun:test";
import {
  SuwayomiClientError,
  SuwayomiClientTimeoutError,
  SuwayomiContentUnavailableError,
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

  test("keeps partial GraphQL data when the host reports a non-fatal error", async () => {
    const client = new SuwayomiRuntimeClient({
      baseUrl: "http://suwayomi.test",
      fetch: async () =>
        Response.json({
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
          errors: [{ message: "A secondary source operation failed." }],
        }),
    });
    await expect(client.listSources()).resolves.toHaveLength(1);
  });

  test("classifies a chapter with no returned pages as unavailable", async () => {
    const client = new SuwayomiRuntimeClient({
      baseUrl: "http://suwayomi.test",
      fetch: async () =>
        Response.json({
          data: { fetchChapterPages: null },
          errors: [{ message: "The extension could not load its pages." }],
        }),
    });

    await expect(client.chapterPages("1")).rejects.toBeInstanceOf(
      SuwayomiContentUnavailableError,
    );
  });
});
