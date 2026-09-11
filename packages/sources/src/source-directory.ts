import type { SourceSummary } from "../../contracts/src";
import { sourceLanguageSchema, sourceSummarySchema } from "../../contracts/src";

import { type ReadingSource, SuwayomiReadingSource } from "./reading-source";
import { type SuwayomiSource, SuwayomiRuntimeClient } from "./suwayomi-client";

export type SourceDirectory = {
  get(id: string): Promise<ReadingSource | undefined>;
  list(languages?: string[]): Promise<SourceSummary[]>;
};

const catalogUrl = "https://github.com/Awerkori/extensoes/raw/repo/index.pb";

export class SuwayomiSourceDirectory implements SourceDirectory {
  constructor(private readonly client: SuwayomiRuntimeClient) {}

  async list(languages?: string[]): Promise<SourceSummary[]> {
    const normalizedLanguages = languages?.map(normalizeLanguage);
    return (await this.client.listSources())
      .map(toDescriptor)
      .filter((source): source is SourceSummary => source !== undefined)
      .filter(
        (source) =>
          normalizedLanguages === undefined ||
          normalizedLanguages.includes(source.language),
      )
      .sort((left, right) => left.name.localeCompare(right.name));
  }

  async get(id: string): Promise<ReadingSource | undefined> {
    const source = (await this.client.listSources()).find(
      (candidate) => descriptorId(candidate) === id,
    );
    if (source === undefined) return undefined;
    const descriptor = toDescriptor(source);
    return descriptor === undefined
      ? undefined
      : new SuwayomiReadingSource(descriptor, source.id, this.client);
  }
}

function toDescriptor(source: SuwayomiSource): SourceSummary | undefined {
  const language = sourceLanguageSchema.safeParse(normalizeLanguage(source.language));
  if (!language.success) return undefined;
  return sourceSummarySchema.parse({
    capabilities: ["search", "details", "chapters", "pages"],
    compatible: true,
    id: descriptorId(source),
    language: language.data,
    name: source.name,
    provenance: { catalogUrl, packageName: source.packageName },
    version: source.version,
  });
}

function descriptorId(source: SuwayomiSource) {
  return `${source.packageName}:${source.id}`;
}

function normalizeLanguage(language: string) {
  const normalized = language.trim().replace(/_/g, "-").toLowerCase();
  if (normalized === "pt" || normalized === "pt-br" || normalized === "por")
    return "pt-BR";
  if (normalized === "en-us" || normalized === "en-gb" || normalized === "eng")
    return "en";
  return normalized;
}
