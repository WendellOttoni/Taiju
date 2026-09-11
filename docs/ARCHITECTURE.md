# Taiju Architecture

## Goals

Taiju is a multi-source reader from the first implementation step. No reading source is privileged in product code, UI behavior or public contracts.

The architecture is intentionally pragmatic: strict isolation around external sources/providers, minimal abstraction elsewhere.

## High-level model

```text
Browser
  |
  v
apps/web (React)
  |
  v
apps/api (Hono)
  |
  +--> packages/sources
  |       |
  |       +--> Project Nox catalog (index.pb)
  |       +--> Source Registry
  |       +--> Source Runtime / Compatibility Layer
  |       +--> normalized ReadingSource capabilities
  |
  +--> packages/providers
  |       +--> AniList
  |       +--> Jikan
  |       +--> trace.moe
  |
  +--> packages/database --> PostgreSQL
  |
  +--> future cache layer --> Redis (only if justified)
```

## Architectural boundaries

### Web

Responsibilities:
- rendering UI;
- client-side interaction/state;
- calling Taiju HTTP endpoints;
- consuming Taiju contracts;
- selecting/filtering sources and languages;
- presenting source provenance and availability.

Must not:
- depend on Project Nox internal structures;
- know how a scan/source is scraped or executed;
- hardcode source-specific routes or parsing rules;
- contain provider credentials;
- consume external DTOs directly.

### API

Responsibilities:
- HTTP routing;
- request validation;
- application orchestration;
- source resolution;
- aggregation where a feature requests multiple sources;
- mapping application results to public API responses;
- authentication/authorization when introduced.

Route handlers should remain thin.

### Contracts

`packages/contracts` contains Taiju-owned schemas/types that cross boundaries.

Examples:
- `SourceSummary`
- `SourceCapability`
- `SourceSearchResult`
- `MangaSummary`
- `MangaDetails`
- `ChapterSummary`
- `ReaderChapter`
- pagination structures
- API error contracts

Use Zod where runtime validation is necessary and infer TypeScript types from schemas where practical.

No contract may encode assumptions about a specific scan/provider unless explicitly scoped as an internal adapter DTO.

## Source engine

`packages/sources` is the core reading integration layer.

The first source catalog is Project Nox:

```text
https://github.com/Awerkori/extensoes/raw/repo/index.pb
```

Responsibilities:
- download and cache source catalog metadata;
- decode/parse `index.pb`;
- enumerate all compatible published sources;
- retain source identity, language, version and provenance;
- determine compatibility/runtime requirements;
- resolve/install/load source implementations according to the chosen runtime strategy;
- expose every reading source through normalized Taiju capabilities;
- isolate failures per source;
- support source updates/version changes;
- support enable/disable and preference rules later.

Directional capability contract:

```ts
interface ReadingSource {
  id: string
  name: string
  language?: string

  search(query: string, options?: SearchOptions): Promise<MangaSummary[]>
  getManga(sourceMangaId: string): Promise<MangaDetails>
  getChapters(sourceMangaId: string): Promise<ChapterSummary[]>
  getPages(sourceChapterId: string): Promise<ReaderChapter>
}
```

This is directional until a numbered task makes the contract binding.

## Source registry vs source runtime

These concepts are separate:

```text
Project Nox index.pb
      ↓
Source Registry
      ↓
source descriptors
      ↓
Source Runtime / Adapter
      ↓
Taiju ReadingSource contract
```

The registry answers which sources exist. The runtime answers how a compatible source executes. Product code consumes only the Taiju contract.

### Language rollout

The initial product slice prioritizes `pt-BR` and `en` sources. The registry must preserve the catalog's language metadata, normalize locale aliases, and expose availability rather than silently discarding other compatible sources. Client preferences determine ordering (`pt-BR` first or `en` first); a fallback is used only when the preferred language has no compatible result.

## Multi-source behavior

Search and reading must be source-neutral.

Directional examples:

```text
GET /api/sources
GET /api/manga/search?q=...&source=...
GET /api/manga/search?q=...&sources=all
GET /api/manga/:source/:id
GET /api/manga/:source/:id/chapters
GET /api/chapters/:source/:id/pages
```

A future aggregated search may query several enabled sources and return grouped/deduplicated results, but cross-source title matching must be explicit and must not rely only on title strings.

No source should be selected implicitly because it was implemented first.

## Metadata providers

`packages/providers` is reserved primarily for non-reading integrations such as:
- AniList;
- Jikan;
- trace.moe.

Metadata enriches reading results but does not determine where content must be read.

If a future reading integration needs a dedicated native adapter for technical reasons, it must still implement the same `ReadingSource` contract and remain indistinguishable to product code except for provenance/capabilities.

## Database

PostgreSQL stores Taiju-owned user/application state, not mirrors of entire external catalogs unless a concrete requirement later justifies it.

Expected future persistence:
- users;
- favorites/library;
- reading progress;
- history;
- preferences;
- enabled/disabled sources;
- preferred languages;
- per-title source choices;
- external/source references required for synchronization.

Drizzle owns schema and migrations.

## Identity strategy

External source IDs must retain provenance.

Bad:

```ts
id: string
```

Prefer source-aware references, e.g.:

```ts
type SourceRef = {
  sourceId: string
  externalId: string
}
```

Persisted Taiju entities may later receive Taiju-owned IDs plus one or more external references.

## Error model

Source failures must not leak implementation details to clients.

Expected categories include:
- validation error;
- source unavailable;
- source incompatible;
- source update required;
- source rate limited;
- upstream timeout;
- not found;
- internal error.

A failing source must not crash unrelated source operations where isolation is applicable.

## Caching

Do not add Redis in bootstrap.

When cache is introduced, policy must consider:
- Project Nox catalog freshness;
- source version updates;
- per-source rate limits;
- stale metadata tolerance;
- page URL expiration;
- invalidation complexity.

## Testing direction

Initial levels:
- deterministic Project Nox catalog parser fixtures;
- source registry tests;
- source compatibility/runtime tests;
- contract tests applied across source implementations;
- API route tests;
- mapping/normalization tests;
- database integration tests when persistence arrives.

Normal CI must not depend on live third-party sites.

## Security

- No secrets in the repository.
- Validate all user-controlled parameters.
- Apply bounded pagination/request limits.
- Do not proxy arbitrary user-supplied URLs.
- Treat source implementations as untrusted external integration code.
- Isolate source execution as much as the runtime permits.
- Verify signatures/fingerprints when the source ecosystem exposes them.

## Evolution rules

- Start as a modular monorepo, not microservices.
- Do not hardcode individual scan/source sites into domain or UI code.
- Do not create a special-case architecture for MangaDex or any other source.
- All reading paths must pass through source capabilities.
- Do not add Redis, queues or event buses until a real requirement exists.
