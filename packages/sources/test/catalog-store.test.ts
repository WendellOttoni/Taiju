import { describe, expect, test } from "bun:test";

import { ProjectNoxCatalogStore } from "../src";

const catalog = {
  name: "fixture",
  badgeLabel: "fixture",
  signingKey: "key",
  contact: { website: "https://example.test" },
  extensions: [],
};

describe("Project Nox catalog store", () => {
  test("deduplicates concurrent refreshes and caches the valid catalog", async () => {
    let calls = 0;
    const store = new ProjectNoxCatalogStore({
      load: async () => {
        calls += 1;
        return catalog;
      },
      ttlMs: 60_000,
    });
    const [first, second] = await Promise.all([store.get(), store.get()]);
    expect(calls).toBe(1);
    expect(first.stale).toBe(false);
    expect(second.catalog.name).toBe("fixture");
    await store.get();
    expect(calls).toBe(1);
  });

  test("serves the previous catalog as stale when refresh fails", async () => {
    let fail = false;
    const store = new ProjectNoxCatalogStore({
      load: async () => {
        if (fail) throw new Error("offline");
        return catalog;
      },
      ttlMs: 1,
    });
    await store.get();
    fail = true;
    await new Promise((resolve) => setTimeout(resolve, 5));
    const stale = await store.get();
    expect(stale.stale).toBe(true);
    expect(stale.catalog.name).toBe("fixture");
  });
});
