import { expect, test } from "bun:test";
import { animeStreamSchema } from "../src";

const stream = {
  audioTracks: [],
  isPreferred: true,
  source: { externalId: "/episode/1", sourceId: "1" },
  subtitleTracks: [],
  title: "HD",
};

test("accepts playback sessions and legacy URLs during the API rollout", () => {
  expect(animeStreamSchema.safeParse({
    ...stream,
    playbackId: "d2d1763e-a0c3-4dcb-a2c3-6f4ddca795bd",
  }).success).toBe(true);
  expect(animeStreamSchema.safeParse({
    ...stream,
    url: "https://video.example/movie.mp4",
  }).success).toBe(true);
  expect(animeStreamSchema.safeParse(stream).success).toBe(false);
});
