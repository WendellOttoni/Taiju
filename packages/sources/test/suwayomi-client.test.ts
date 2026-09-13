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
                  contentWarning: "SAFE",
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
        contentWarning: "SAFE",
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
                  contentWarning: "NSFW",
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

  test("rejects unknown source content classifications", async () => {
    const client = new SuwayomiRuntimeClient({
      baseUrl: "http://suwayomi.test",
      fetch: async () =>
        Response.json({
          data: {
            sources: {
              nodes: [
                {
                  contentWarning: "UNKNOWN",
                  extension: {
                    pkgName: "example.source",
                    versionName: "1.0",
                  },
                  id: "1",
                  lang: "en",
                  name: "Example",
                },
              ],
            },
          },
        }),
    });
    await expect(client.listSources()).rejects.toBeInstanceOf(
      SuwayomiClientError,
    );
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

  test("resolves relative chapter page URLs against the runtime origin", async () => {
    const client = new SuwayomiRuntimeClient({
      baseUrl: "http://suwayomi.test",
      fetch: async () =>
        Response.json({
          data: { fetchChapterPages: { pages: ["/api/v1/manga/1/page/0"] } },
        }),
    });

    await expect(client.chapterPages("1")).resolves.toEqual([
      "http://suwayomi.test/api/v1/manga/1/page/0",
    ]);
  });

  test("rewrites runtime asset URLs to the configured public base", async () => {
    const client = new SuwayomiRuntimeClient({
      baseUrl: "http://suwayomi.test",
      publicBaseUrl: "https://reader.test/suwayomi",
      fetch: async () =>
        Response.json({
          data: { fetchChapterPages: { pages: ["/api/v1/manga/1/page/0"] } },
        }),
    });

    await expect(client.chapterPages("1")).resolves.toEqual([
      "https://reader.test/suwayomi/api/v1/manga/1/page/0",
    ]);
  });

  test("coalesces concurrent details and chapter requests for the same manga", async () => {
    let calls = 0;
    const client = new SuwayomiRuntimeClient({
      baseUrl: "http://suwayomi.test",
      fetch: async () => {
        calls += 1;
        return Response.json({
          data: {
            fetchMangaAndChapters: {
              chapters: [],
              manga: {
                genre: [],
                id: 1,
                status: "ONGOING",
                title: "Example",
              },
            },
          },
        });
      },
    });

    const [first, second] = await Promise.all([
      client.mangaAndChapters("1"),
      client.mangaAndChapters("1"),
    ]);
    expect(first.manga.title).toBe("Example");
    expect(second.chapters).toEqual([]);
    expect(calls).toBe(1);
  });

  test("retries one transient manga request failure", async () => {
    let calls = 0;
    const client = new SuwayomiRuntimeClient({
      baseUrl: "http://suwayomi.test",
      fetch: async () => {
        calls += 1;
        if (calls === 1) return new Response("", { status: 503 });
        return Response.json({
          data: {
            fetchMangaAndChapters: {
              chapters: [],
              manga: {
                genre: [],
                id: 1,
                status: "ONGOING",
                title: "Example",
              },
            },
          },
        });
      },
    });

    await expect(client.mangaAndChapters("1")).resolves.toMatchObject({
      manga: { title: "Example" },
    });
    expect(calls).toBe(2);
  });

  test("uses the runtime popular operation for source discovery", async () => {
    let input: unknown;
    let calls = 0;
    const client = new SuwayomiRuntimeClient({
      baseUrl: "http://suwayomi.test",
      fetch: async (_url, init) => {
        calls += 1;
        input = JSON.parse(String(init?.body)) as unknown;
        return Response.json({
          data: { fetchSourceManga: { hasNextPage: false, mangas: [] } },
        });
      },
    });

    await expect(client.discover("source-1", "POPULAR")).resolves.toEqual({
      hasNextPage: false,
      items: [],
    });
    expect(input).toMatchObject({
      variables: {
        input: { page: 1, query: "", source: "source-1", type: "POPULAR" },
      },
    });
    await client.discover("source-1", "POPULAR");
    expect(calls).toBe(1);
  });

  test("retries chapter pages once when the source returns no pages", async () => {
    let calls = 0;
    const client = new SuwayomiRuntimeClient({
      baseUrl: "http://suwayomi.test",
      fetch: async () => {
        calls += 1;
        return Response.json({
          data: {
            fetchChapterPages:
              calls === 1 ? null : { pages: ["/api/v1/manga/1/page/0"] },
          },
        });
      },
    });

    await expect(client.chapterPages("1")).resolves.toEqual([
      "http://suwayomi.test/api/v1/manga/1/page/0",
    ]);
    expect(calls).toBe(2);
  });
});
