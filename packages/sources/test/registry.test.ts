import { describe, expect, test } from "bun:test";
import type { ProjectNoxCatalog } from "../src";
import { createSourceRegistry } from "../src";

const catalog: ProjectNoxCatalog = {
  name: "Nox",
  badgeLabel: "N",
  signingKey: "key",
  contact: { website: "https://example.test" },
  extensions: [
    {
      name: "Ext",
      packageName: "pkg.ext",
      apkUrl: "https://example.test/a.apk",
      iconUrl: "https://example.test/i.png",
      extensionLib: "1.6",
      versionCode: 1n,
      versionName: "1.0",
      contentWarning: 0,
      sources: [
        {
          id: "1",
          name: "English",
          language: "en-US",
          homeUrl: "https://english.test",
          mirrorUrls: [],
        },
        {
          id: "2",
          name: "Português",
          language: "pt_BR",
          homeUrl: "https://portuguese.test",
          mirrorUrls: [],
        },
      ],
    },
  ],
};

describe("SourceRegistry", () => {
  test("normalizes languages, keeps provenance and prioritizes preferences", () => {
    const registry = createSourceRegistry(catalog, {
      catalogUrl: "https://catalog.test/index.pb",
      compatible: () => true,
    });
    const entries = registry.list({ preferredLanguages: ["pt-BR", "en"] });
    expect(entries.map((entry) => entry.language)).toEqual(["pt-BR", "en"]);
    expect(entries[0]?.provenance.packageName).toBe("pkg.ext");
    expect(entries[0]?.enabled).toBe(true);
  });
  test("filters disabled and exposes compatibility", () => {
    const registry = createSourceRegistry(catalog, {
      catalogUrl: "https://catalog.test/index.pb",
    });
    expect(registry.list()).toHaveLength(0);
    expect(registry.list({ includeDisabled: true })[0]?.compatible).toBe(false);
    expect(registry.setEnabled("pkg.ext:1", true)).toBe(true);
    expect(registry.list()).toHaveLength(1);
  });
});
