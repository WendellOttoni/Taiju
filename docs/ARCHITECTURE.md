# Taiju Architecture

## Goals

Taiju should remain easy to evolve while integrating multiple third-party content and metadata providers.

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
- consuming Taiju contracts.

Must not:
- depend on MangaDex/AniList/Jikan DTO shapes;
- contain provider credentials;
- embed provider business rules that belong in the API/provider layer.

### API

Responsibilities:
- HTTP routing;
- request validation;
- application orchestration;
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
- pagination structures
- API error contracts

Use Zod where runtime validation is necessary and infer TypeScript types from schemas where practical.

### Providers

Every external service gets an isolated adapter.

A provider owns:
- HTTP client configuration;
- provider-specific DTOs;
- response validation where useful;
- rate-limit/error translation;
- mapping into Taiju-level data structures.

Initial providers:
- MangaDex;
- AniList;
- Jikan;
- trace.moe.

The first implementation target is MangaDex.

### Database

PostgreSQL stores Taiju-owned user/application state, not mirrored copies of whole provider catalogs unless a future requirement explicitly justifies it.

Expected future persistence includes:
- users;
- favorites/library;
- reading progress;
- history;
- preferences;
- provider references needed for synchronization.

Drizzle owns schema and migrations.

## Identity strategy

External provider IDs must remain explicit.

Bad:

```ts
id: string // ambiguous provider id
```

Prefer structures that retain provenance, e.g. provider + providerId, or Taiju-owned IDs for persisted entities with provider references stored separately.

The exact persisted identity model will be defined when user/library persistence is implemented.

## API style

Taiju will expose REST-style HTTP endpoints initially.

Example direction:

```text
GET /health
GET /api/manga/search?q=...
GET /api/manga/:provider/:id
GET /api/manga/:provider/:id/chapters
GET /api/chapters/:provider/:id/pages
```

These are directional examples, not contracts yet. Endpoint design becomes binding only when introduced by a numbered task.

## Error model

Provider errors should not leak directly to consumers.

Expected categories include:
- validation error;
- not found;
- provider unavailable;
- provider rate limited;
- upstream timeout;
- internal error.

Detailed mapping will be implemented with the first provider integration.

## Caching

Do not add Redis in the bootstrap task.

Start with no distributed cache. Add caching after concrete API behavior demonstrates a need. When introduced, cache policy must account for:
- provider rate limits;
- stale metadata tolerance;
- chapter/page URL expiration where applicable;
- invalidation complexity.

## Testing direction

Initial levels:
- unit tests for mapping/normalization logic;
- API route tests for Taiju endpoints;
- provider client tests with deterministic mocked responses;
- integration tests for database behavior when persistence arrives.

Avoid tests that depend on live third-party APIs in normal CI.

## Security

- No secrets in the repository.
- External credentials are environment variables/secrets.
- Validate all user-controlled parameters.
- Apply bounded pagination and request limits.
- Do not proxy arbitrary URLs supplied by users.
- Content availability and provider terms must be respected by integrations.

## Evolution rules

Do not create microservices at the start.

Taiju begins as a modular monorepo. Split deployables only if operational needs later justify it.

Do not introduce queues, Redis, event buses or elaborate domain layers without a real task requiring them.
