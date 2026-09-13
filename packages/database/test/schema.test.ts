import { expect, test } from "bun:test";

import {
  animeLibraryEntries,
  animeWatchHistory,
  profiles,
  users,
} from "../src/schema";

test("defines Taiju-owned users and profiles", () => {
  expect(users.id.name).toBe("id");
  expect(users.email.name).toBe("email");
  expect(profiles.userId.name).toBe("user_id");
});

test("defines separate anime library and watch history tables", () => {
  expect(animeLibraryEntries.sourceId.name).toBe("source_id");
  expect(animeLibraryEntries.animeExternalId.name).toBe("anime_external_id");
  expect(animeWatchHistory.episodeExternalId.name).toBe(
    "episode_external_id",
  );
  expect(animeWatchHistory.positionSeconds.name).toBe("position_seconds");
});
