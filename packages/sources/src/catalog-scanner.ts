import type { ProjectNoxCatalog, ProjectNoxExtension } from "./catalog-decoder";
import type { SuwayomiSource } from "./suwayomi-client";

export type CatalogSourceStatus =
  | "compatible"
  | "runtime_missing"
  | "version_mismatch";

export type CatalogSourceScan = {
  extension: Pick<
    ProjectNoxExtension,
    "name" | "packageName" | "versionName" | "versionCode"
  >;
  source: { id: string; language: string; name: string };
  runtimeVersion?: string;
  status: CatalogSourceStatus;
};

export type CatalogScanReport = {
  catalogExtensions: number;
  runtimeSources: number;
  results: CatalogSourceScan[];
  counts: Record<CatalogSourceStatus, number>;
};

/**
 * Compares the published Project Nox catalog with the sources loaded by a
 * Suwayomi instance. It intentionally performs no network or runtime calls,
 * so the result is deterministic and suitable for CI and persisted snapshots.
 */
export function scanProjectNoxCatalog(
  catalog: ProjectNoxCatalog,
  runtimeSources: readonly SuwayomiSource[],
): CatalogScanReport {
  const runtimeByKey = new Map(
    runtimeSources.map((source) => [
      runtimeKey(source.packageName, source.id),
      source,
    ]),
  );
  const results: CatalogSourceScan[] = [];

  for (const extension of catalog.extensions) {
    for (const source of extension.sources) {
      const runtime = runtimeByKey.get(
        runtimeKey(extension.packageName, source.id),
      );
      const status: CatalogSourceStatus =
        runtime === undefined
          ? "runtime_missing"
          : runtime.version !== extension.versionName
            ? "version_mismatch"
            : "compatible";
      results.push({
        extension: {
          name: extension.name,
          packageName: extension.packageName,
          versionCode: extension.versionCode,
          versionName: extension.versionName,
        },
        source: { id: source.id, language: source.language, name: source.name },
        runtimeVersion: runtime?.version,
        status,
      });
    }
  }

  const counts: Record<CatalogSourceStatus, number> = {
    compatible: 0,
    runtime_missing: 0,
    version_mismatch: 0,
  };
  for (const result of results) counts[result.status] += 1;

  return {
    catalogExtensions: catalog.extensions.length,
    runtimeSources: runtimeSources.length,
    results,
    counts,
  };
}

function runtimeKey(packageName: string, sourceId: string) {
  return `${packageName}:${sourceId}`;
}
