import type {
  SourceCapability,
  SourceSummary,
} from "../../contracts/src/source";
import {
  sourceLanguageSchema,
  sourceProvenanceSchema,
  sourceSummarySchema,
} from "../../contracts/src/source";
import type { ProjectNoxCatalog, ProjectNoxExtension } from "./catalog-decoder";

export type RegisteredSource = SourceSummary & { enabled: boolean };
export type SourceRegistryOptions = {
  catalogUrl: string;
  compatible?: (extension: ProjectNoxExtension) => boolean;
  capabilities?: SourceCapability[];
};
export type SourceListOptions = {
  languages?: string[];
  includeDisabled?: boolean;
  preferredLanguages?: string[];
};

const normalizeLanguage = (language: string) => {
  const normalized = language.trim().replace(/_/g, "-").toLowerCase();
  if (normalized === "pt" || normalized === "pt-br" || normalized === "por")
    return "pt-BR";
  if (normalized === "en-us" || normalized === "en-gb" || normalized === "eng")
    return "en";
  return normalized;
};
const sourceKey = (packageName: string, externalId: string) =>
  `${packageName}:${externalId}`;

export class SourceRegistry {
  private readonly entries = new Map<string, RegisteredSource>();
  private readonly options: Required<
    Pick<SourceRegistryOptions, "catalogUrl">
  > &
    Pick<SourceRegistryOptions, "compatible" | "capabilities">;
  constructor(options: SourceRegistryOptions) {
    sourceProvenanceSchema.shape.catalogUrl.parse(options.catalogUrl);
    this.options = {
      catalogUrl: options.catalogUrl,
      compatible: options.compatible,
      capabilities: options.capabilities,
    };
  }
  load(catalog: ProjectNoxCatalog) {
    this.entries.clear();
    for (const extension of catalog.extensions) {
      const compatible = this.options.compatible?.(extension) ?? false;
      for (const source of extension.sources) {
        const language = sourceLanguageSchema.parse(
          normalizeLanguage(source.language),
        );
        const descriptor = sourceSummarySchema.parse({
          id: sourceKey(extension.packageName, source.id),
          name: source.name,
          language,
          version: extension.versionName,
          compatible,
          capabilities: compatible
            ? (this.options.capabilities ?? [
                "search",
                "details",
                "chapters",
                "pages",
              ])
            : ["search"],
          provenance: {
            catalogUrl: this.options.catalogUrl,
            packageName: extension.packageName,
            sourceUrl: source.homeUrl,
          },
        });
        this.entries.set(descriptor.id, { ...descriptor, enabled: compatible });
      }
    }
  }
  list(options: SourceListOptions = {}): RegisteredSource[] {
    const languages = options.languages?.map(normalizeLanguage);
    const preferred = options.preferredLanguages?.map(normalizeLanguage) ?? [];
    return [...this.entries.values()]
      .filter((entry) => options.includeDisabled || entry.enabled)
      .filter(
        (entry) => !languages?.length || languages.includes(entry.language),
      )
      .sort((a, b) => {
        const ai = preferred.indexOf(a.language);
        const bi = preferred.indexOf(b.language);
        return (
          (ai < 0 ? preferred.length : ai) - (bi < 0 ? preferred.length : bi) ||
          a.name.localeCompare(b.name)
        );
      });
  }
  get(id: string) {
    return this.entries.get(id);
  }
  setEnabled(id: string, enabled: boolean) {
    const entry = this.entries.get(id);
    if (!entry) return false;
    entry.enabled = enabled;
    return true;
  }
}

export function createSourceRegistry(
  catalog: ProjectNoxCatalog,
  options: SourceRegistryOptions,
) {
  const registry = new SourceRegistry(options);
  registry.load(catalog);
  return registry;
}
