# Taiju Roadmap

This roadmap is directional. Numbered task files define executable scope.

## Phase 0 — Foundation

- TASK-001 — bootstrap Bun monorepo
- TASK-002 — establish shared contracts package
- TASK-003 — establish provider package conventions
- TASK-004 — add CI quality checks

## Phase 1 — Manga discovery

- MangaDex HTTP client
- normalized manga search contract
- search API endpoint
- search UI
- manga details
- cover rendering
- pagination/error/loading states

## Phase 2 — Chapters and reader

- chapter feed/listing
- language filters
- MangaDex@Home page resolution
- vertical reader
- page-by-page reader
- keyboard navigation
- image preloading
- chapter navigation

## Phase 3 — Persistence

- PostgreSQL + Drizzle
- user identity/authentication
- library/favorites
- reading history
- chapter/page progress
- user preferences

## Phase 4 — Anime companion (deferred)

- AniList integration
- anime search/details
- seasonal discovery
- tracking metadata
- streaming-provider links where legally exposed by providers
- Jikan fallback/complementary metadata
- trace.moe screenshot identification

## Phase 5 — Discovery and recommendations

- related titles
- recommendation surfaces
- personalized discovery based on library/history
- cross-media relationships (manga/anime)

## Phase 6 — Reliability and scale

- caching based on measured provider/API needs
- rate-limit policies
- observability
- performance profiling
- provider fallback strategy
- deployment hardening

## Non-goals for the initial MVP

- microservices;
- self-hosting copies of third-party catalogs;
- arbitrary URL proxying;
- social/community features;
- chat/messaging;
- custom recommendation ML models;
- native mobile apps.

These can be reconsidered after the core reader/tracker experience is stable.
