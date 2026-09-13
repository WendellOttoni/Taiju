import { expect, test } from "bun:test";
import { MiwayomiClient, MiwayomiClientError } from "../src";

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

function json(value: unknown) {
  return new Response(JSON.stringify(value), {
    headers: { "content-type": "application/json" },
  });
}
