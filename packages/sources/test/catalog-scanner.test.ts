import { describe, expect, test } from "bun:test";
import type { ProjectNoxCatalog } from "../src";
import { scanProjectNoxCatalog } from "../src";

const catalog: ProjectNoxCatalog = {
  name: "fixture",
  badgeLabel: "fixture",
  signingKey: "key",
  contact: { website: "https://example.test" },
  extensions: [
    {
      name: "Example",
      packageName: "org.example",
      apkUrl: "https://example.test/example.apk",
      iconUrl: "https://example.test/icon.png",
      extensionLib: "1",
      versionCode: 3n,
      versionName: "1.2.0",
      contentWarning: 0,
      sources: [
        { id: "10", name: "Example PT", language: "pt-br", mirrorUrls: [] },
        { id: "11", name: "Example EN", language: "en", mirrorUrls: [] },
      ],
    },
  ],
};

describe("Project Nox catalog scanner", () => {
  test("classifies loaded, missing and stale runtime sources", () => {
    const report = scanProjectNoxCatalog(catalog, [
      {
        contentWarning: "SAFE",
        id: "10",
        language: "pt-BR",
        name: "Example PT",
        packageName: "org.example",
        version: "1.2.0",
      },
      {
        contentWarning: "SAFE",
        id: "11",
        language: "en",
        name: "Example EN",
        packageName: "org.example",
        version: "1.1.0",
      },
    ]);

    expect(report.catalogExtensions).toBe(1);
    expect(report.runtimeSources).toBe(2);
    expect(report.counts).toEqual({
      compatible: 1,
      runtime_missing: 0,
      version_mismatch: 1,
    });
    expect(report.results[1]?.runtimeVersion).toBe("1.1.0");
  });

  test("does not invent compatibility for catalog sources absent in runtime", () => {
    const report = scanProjectNoxCatalog(catalog, []);
    expect(report.counts.runtime_missing).toBe(2);
    expect(
      report.results.every((result) => result.status === "runtime_missing"),
    ).toBe(true);
  });
});
