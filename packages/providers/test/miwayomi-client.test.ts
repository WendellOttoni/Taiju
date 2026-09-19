import { expect, test } from "bun:test";
import {
  MiwayomiClient,
  MiwayomiClientError,
  MiwayomiContentUnavailableError,
} from "../src";

test("MiwayomiClient maps anime sources, catalog entries, episodes and streams", async () => {
  const paths: string[] = [];
  const client = new MiwayomiClient({
    baseUrl: "http://miwayomi.test",
    fetch: async (input) => {
      const url = new URL(input.toString());
      paths.push(`${url.pathname}${url.search}`);
      if (url.pathname.endsWith("/sources"))
        return json({
          anime: [
            {
              id: "9007199254740993",
              lang: "pt_BR",
              name: "Anime source",
              pkg: "example.anime",
              type: "anime",
            },
          ],
        });
      if (url.pathname.endsWith("/search"))
        return json({
          animes: [
            {
              artist: null,
              author: "Author",
              background_url: null,
              description: "Description",
              genre: "Action, Fantasy",
              status: 1,
              thumbnail_url: "https://images.example/cover.jpg",
              title: "Taiju Anime",
              url: "/anime/taiju",
            },
          ],
          hasNextPage: false,
        });
      if (url.pathname.endsWith("/episodes"))
        return json({
          episodes: [
            {
              episode_number: 1,
              name: "Episode 1",
              preview_url: null,
              summary: "First episode",
              url: "/episode/1",
            },
          ],
        });
      return json({
        videos: [
          {
            audioTracks: [{ lang: "Japanese", url: "https://cdn.example/ja.m3u8" }],
            bitrate: 2_000_000,
            preferred: true,
            resolution: 1080,
            subtitleTracks: [
              { lang: "Português", url: "https://cdn.example/pt.vtt" },
            ],
            videoTitle: "1080p",
            videoUrl: "https://cdn.example/video.m3u8",
          },
        ],
      });
    },
  });

  expect(await client.listSources()).toEqual([
    {
      id: "9007199254740993",
      language: "pt-BR",
      name: "Anime source",
      packageName: "example.anime",
    },
  ]);
  expect(
    await client.search("9007199254740993", { page: 1, query: "Taiju" }),
  ).toMatchObject({
    hasNextPage: false,
    items: [
      {
        source: { externalId: "/anime/taiju", sourceId: "9007199254740993" },
        tags: ["Action", "Fantasy"],
        title: "Taiju Anime",
      },
    ],
  });
  expect(
    await client.episodes("9007199254740993", "/anime/taiju"),
  ).toMatchObject({
    items: [
      {
        anime: { externalId: "/anime/taiju", sourceId: "9007199254740993" },
        source: { externalId: "/episode/1", sourceId: "9007199254740993" },
      },
    ],
  });
  expect(
    await client.streams("9007199254740993", "/episode/1"),
  ).toMatchObject({
    items: [
      {
        isPreferred: true,
        quality: 1080,
        subtitleTracks: [{ label: "Português" }],
      },
    ],
  });
  expect(paths).toContain(
    "/api/v1/anime/9007199254740993/search?page=1&query=Taiju",
  );
});

test("MiwayomiClient translates runtime failures", async () => {
  const client = new MiwayomiClient({
    baseUrl: "http://miwayomi.test",
    fetch: async () => new Response(null, { status: 503 }),
  });

  await expect(client.listSources()).rejects.toBeInstanceOf(MiwayomiClientError);
});

test("MiwayomiClient reports episodes without streams as unavailable", async () => {
  const client = new MiwayomiClient({
    baseUrl: "http://miwayomi.test",
    fetch: async () => json({ videos: [] }),
  });

  await expect(client.streams("1", "/episode/1")).rejects.toBeInstanceOf(
    MiwayomiContentUnavailableError,
  );
});

test("MiwayomiClient proxies streams with extension-provided headers and ranges", async () => {
  let videoRequest: Request | undefined;
  let resolutions = 0;
  const client = new MiwayomiClient({
    baseUrl: "http://miwayomi.test",
    fetch: async (input, init) => {
      if (input.toString().includes("/videos")) {
        resolutions++;
        return json({
          videos: [
            {
              preferred: true,
              videoTitle: "HD",
              videoUrl: "https://video.example/episode.mp4",
              headers: {
                referer: "https://source.example/",
                "user-agent": "source-agent",
              },
            },
          ],
        });
      }
      videoRequest = new Request(input, init);
      return new Response("video", {
        headers: {
          "content-length": "5",
          "content-range": "bytes 1-5/100",
          "content-type": "video/mp4",
        },
        status: 206,
      });
    },
  });

  const playbackId = (await client.streams("1", "/episode/1")).items[0]?.playbackId;
  if (playbackId === undefined) throw new Error("Missing playback session.");
  const response = await client.proxyStream(playbackId, "bytes=1-5");
  expect(response.status).toBe(206);
  expect(await response.text()).toBe("video");
  expect(response.headers.get("cache-control")).toBe("private, no-store");
  expect(resolutions).toBe(1);
  expect(videoRequest?.headers.get("referer")).toBe("https://source.example/");
  expect(videoRequest?.headers.get("user-agent")).toBe("source-agent");
  expect(videoRequest?.headers.get("range")).toBe("bytes=1-5");
});

test("MiwayomiClient keeps concurrent viewers on their own resolved video", async () => {
  let resolutions = 0;
  const requests: string[] = [];
  const client = new MiwayomiClient({
    baseUrl: "http://miwayomi.test",
    fetch: async (input, init) => {
      if (input.toString().includes("/videos")) {
        resolutions++;
        return json({
          videos: [{
            videoTitle: "HD",
            videoUrl: `https://video.example/viewer-${resolutions}.mp4`,
            headers: { referer: `https://viewer-${resolutions}.example/` },
          }],
        });
      }
      const request = new Request(input, init);
      requests.push(`${request.url}|${request.headers.get("referer")}|${request.headers.get("range")}`);
      return new Response("video", {
        headers: { "content-range": "bytes 100-104/1000" },
        status: 206,
      });
    },
  });

  const first = (await client.streams("1", "/episode/1")).items[0];
  const second = (await client.streams("1", "/episode/1")).items[0];
  if (first === undefined || second === undefined)
    throw new Error("Missing playback session.");
  if (first.playbackId === undefined || second.playbackId === undefined)
    throw new Error("Missing playback identifier.");
  expect(first.playbackId).not.toBe(second.playbackId);
  expect("url" in first).toBe(false);
  await client.proxyStream(first.playbackId, "bytes=100-");
  await client.proxyStream(second.playbackId, "bytes=100-");
  await client.proxyStream(first.playbackId, "bytes=100-");
  expect(resolutions).toBe(2);
  expect(requests).toEqual([
    "https://video.example/viewer-1.mp4|https://viewer-1.example/|bytes=100-",
    "https://video.example/viewer-2.mp4|https://viewer-2.example/|bytes=100-",
    "https://video.example/viewer-1.mp4|https://viewer-1.example/|bytes=100-",
  ]);
});

test("MiwayomiClient keeps playing when later source extraction is unavailable", async () => {
  let resolutions = 0;
  const client = new MiwayomiClient({
    baseUrl: "http://miwayomi.test",
    fetch: async (input) => {
      if (input.toString().includes("/videos")) {
        resolutions++;
        return json({
          videos: resolutions === 1
            ? [{ videoTitle: "HD", videoUrl: "https://video.example/movie.mp4" }]
            : [],
        });
      }
      return new Response("video", {
        headers: { "content-range": "bytes 100-104/1000" },
        status: 206,
      });
    },
  });

  const playbackId = (await client.streams("1", "/episode/1")).items[0]?.playbackId;
  if (playbackId === undefined) throw new Error("Missing playback session.");
  const response = await client.proxyStream(playbackId, "bytes=100-");
  expect(response.status).toBe(206);
  expect(resolutions).toBe(1);
  await response.body?.cancel();
});

test("MiwayomiClient rejects a host response that would reset a seeking player", async () => {
  const client = new MiwayomiClient({
    baseUrl: "http://miwayomi.test",
    fetch: async (input) => input.toString().includes("/videos")
      ? json({ videos: [{ videoTitle: "HD", videoUrl: "https://video.example/movie.mp4" }] })
      : new Response("whole movie", { status: 200 }),
  });
  const playbackId = (await client.streams("1", "/episode/1")).items[0]?.playbackId;
  if (playbackId === undefined) throw new Error("Missing playback session.");
  await expect(client.proxyStream(playbackId, "bytes=100-")).rejects.toThrow(
    "incorrect byte range",
  );
});

test("MiwayomiClient does not abort an established long video response", async () => {
  let videoSignal: AbortSignal | undefined;
  const client = new MiwayomiClient({
    baseUrl: "http://miwayomi.test",
    timeoutMs: 10,
    fetch: async (input, init) => {
      if (input.toString().includes("/videos"))
        return json({ videos: [{ videoTitle: "HD", videoUrl: "https://video.example/movie.mp4" }] });
      videoSignal = init?.signal ?? undefined;
      return new Response("video");
    },
  });
  const playbackId = (await client.streams("1", "/episode/1")).items[0]?.playbackId;
  if (playbackId === undefined) throw new Error("Missing playback session.");
  await client.proxyStream(playbackId);
  await Bun.sleep(20);
  expect(videoSignal?.aborted).toBe(false);
});

function json(value: unknown) {
  return new Response(JSON.stringify(value), {
    headers: { "content-type": "application/json" },
  });
}
