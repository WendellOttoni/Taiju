# Taiju Architecture

## Goals

Taiju should remain easy to evolve while integrating multiple third-party content, metadata and reading sources.

The architecture is intentionally pragmatic: clear boundaries where they protect the product, minimal abstraction elsewhere.

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
  +--> packages/providers --> MangaDex
  |                     \--> AniList
  |                     \--> Jikan
  |                     \--> trace.moe
  |
  +--> packages/sources --> Project Nox catalog (index.pb)
  |                    \--> source adapters/extensions
  |                    \--> normalized source capabilities
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
- allowing source selection where multiple sources expose the same title.

Must not:
- depend on MangaDex/AniList/Jikan/Project Nox internal DTO shapes;
- contain provider credentials;
- execute source-specific scraping/parsing logic;
- embed provider business rules that belong in the API/provider/source layers.

### API

Responsibilities:
- HTTP routing;
- request validation;
- application orchestration;
- source/provider resolution;
- mapping application results to public API responses;
- authentication/authorization when introduced.

Route handlers should remain thin.

### Contracts

`packages/contracts` contains Taiju-owned schemas/types that cross boundaries.

Examples:
- `MangaSummary`
- `MangaDetails`
- `ChapterSummary`
- `ReaderChapter`
- `SourceSummary`
- `SourceCapability`
- pagination structures
- API error contracts

Use Zod where runtime validation is necessary and infer TypeScript types from schemas where practical.

### Native providers

`packages/providers` contains integrations that Taiju owns directly.

A native provider owns:
- HTTP client configuration;
- provider-specific DTOs;
- response validation where useful;
- rate-limit/error translation;
- mapping into Taiju-level data structures.

Initial native providers:
- MangaDex;
- AniList;
- Jikan;
- trace.moe.

MangaDex remains the first native reading-provider implementation and a reference for Taiju contracts.

### Source engine

`packages/sources` is responsible for dynamic reading sources and source catalogs.

The first catalog is Project Nox:

```text
https://github.com/Awerkori/extensoes/raw/repo/index.pb
```

Project Nox publishes a modern binary source index and compiled source extensions. Taiju must treat the catalog as external registry metadata and translate it into its own internal source model.

Responsibilities of the source engine:
- download and cache source catalog metadata;
- decode/parse the Project Nox `index.pb` format;
- enumerate every compatible source published by the catalog;
- retain source identity, language, version and provenance;
- resolve/install/load source implementations according to the supported runtime strategy;
- expose source capabilities through a normalized Taiju interface;
- isolate source failures so one broken source does not affect the whole application;
- support source updates without requiring product-wide refactoring.

Target capability contract, conceptually:

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

This interface is directional, not binding until defined by a numbered task.

The product goal is to support **all Project Nox sources that are technically compatible with the Taiju runtime**, rather than manually maintaining a curated subset.

### Source registry vs source implementation

These concepts must remain separate:

```text
Project Nox index.pb
      ↓
Source Registry
      ↓
installed/available source descriptors
      ↓
Source Runtime / Adapter
      ↓
Taiju ReadingSource contract
```

The registry tells Taiju which sources exist and how they are versioned. The runtime executes or adapts the source implementation. Product code consumes only Taiju contracts.

### Database

PostgreSQL stores Taiju-owned user/application state, not mirrored copies of whole provider catalogs unless a future requirement explicitly justifies it.

Expected future persistence includes:
- users;
- favorites/library;
- reading progress;
- history;
- preferences;
- enabled/disabled source preferences;
- provider/source references needed for synchronization.

Drizzle owns schema and migrations.

## Identity strategy

External provider and source IDs must remain explicit.

Bad:

```ts
id: string // ambiguous provider/source id
```

Prefer structures that retain provenance, e.g. source/provider + external ID, or Taiju-owned IDs for persisted entities with external references stored separately.

The exact persisted identity model will be defined when user/library persistence is implemented.

## API style

Taiju will expose REST-style HTTP endpoints initially.

Example direction:

```text
GET /health
GET /api/sources
GET /api/sources/:sourceId
GET /api/manga/search?q=...
GET /api/manga/:source/:id
GET /api/manga/:source/:id/chapters
GET /api/chapters/:source/:id/pages
```

These are directional examples, not contracts yet. Endpoint design becomes binding only when introduced by a numbered task.

## Error model

Provider/source errors should not leak directly to consumers.

Expected categories include:
- validation error;
- source not available;
- source incompatible;
- source update required;
- not found;
- provider/source unavailable;
- provider/source rate limited;
- upstream timeout;
- internal error.

Detailed mapping will be implemented with the first source/provider integrations.

## Caching

Do not add Redis in the bootstrap task.

Start with no distributed cache. Add caching after concrete API behavior demonstrates a need. When introduced, cache policy must account for:
- source catalog freshness;
- provider/source rate limits;
- stale metadata tolerance;
- chapter/page URL expiration where applicable;
- invalidation complexity.

## Testing direction

Initial levels:
- unit tests for mapping/normalization logic;
- API route tests for Taiju endpoints;
- provider client tests with deterministic mocked responses;
- source registry/parser tests using deterministic Project Nox fixtures;
- source capability contract tests;
- integration tests for database behavior when persistence arrives.

Avoid tests that depend on live third-party APIs/sites in normal CI.

## Security

- No secrets in the repository.
- External credentials are environment variables/secrets.
- Validate all user-controlled parameters.
- Apply bounded pagination and request limits.
- Do not proxy arbitrary URLs supplied by users.
- Source implementations are untrusted external integration code and must be isolated as much as the chosen runtime permits.
- Verify available signatures/fingerprints when the source ecosystem exposes them.

## Evolution rules

Do not create microservices at the start.

Taiju begins as a modular monorepo. Split deployables only if operational needs later justify it.

Do not introduce queues, Redis, event buses or elaborate domain layers without a real task requiring them.

Do not hardcode individual scan/source sites in domain or UI code. All dynamic reading sources must flow through the source engine.
