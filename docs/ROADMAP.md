# Taiju Roadmap

This roadmap is directional. Numbered task files define executable scope.

## Phase 0 — Foundation

- TASK-001 — bootstrap Bun monorepo
- TASK-002 — establish shared contracts package
- TASK-003 — establish provider/source package conventions
- TASK-004 — add CI quality checks

## Phase 1 — Source engine and Project Nox catalog

- define normalized Taiju reading-source contracts
- add `packages/sources`
- download and cache Project Nox repository metadata
- parse/decode Project Nox `index.pb`
- enumerate all catalog extensions/sources
- retain source name, language, version, package identity and provenance
- define source compatibility checks
- define extension loading/adaptation runtime
- expose available sources through Taiju API
- isolate failures per source
- support source updates/version changes

Primary Project Nox catalog:

```text
https://github.com/Awerkori/extensoes/raw/repo/index.pb
```

Goal: Taiju should expose every Project Nox source that is technically compatible with its source runtime, rather than maintaining a small hardcoded source list.

## Phase 2 — Native MangaDex reference provider and discovery

- MangaDex HTTP client
- normalized manga search contract
- search API endpoint
- search UI
- manga details
- cover rendering
- pagination/error/loading states
- verify contracts align with the generic source engine

MangaDex acts both as a usable native source and as a reference implementation for Taiju's normalized reading contracts.

## Phase 3 — Multi-source chapters and reader

- source selection per title/search result
- chapter feed/listing from selected source
- language filters
- source-specific chapter/page resolution behind adapters
- MangaDex@Home page resolution for MangaDex
- vertical reader
- page-by-page reader
- keyboard navigation
- image preloading
- chapter navigation
- source failure/fallback UX

## Phase 4 — Persistence

- PostgreSQL + Drizzle
- user identity/authentication
- library/favorites
- reading history
- chapter/page progress
- user preferences
- preferred/enabled sources

## Phase 5 — Unified catalog and metadata

- AniList integration
- provider/source identity mapping
- cross-source title matching strategy
- rich metadata enrichment
- Jikan fallback/complementary metadata
- provider resolution layer

## Phase 6 — Anime companion

- anime search/details
- seasonal discovery
- tracking metadata
- streaming-provider links where exposed by metadata providers
- trace.moe screenshot identification

## Phase 7 — Discovery and recommendations

- related titles
- recommendation surfaces
- personalized discovery based on library/history
- cross-media relationships (manga/anime)
- source-aware availability indicators

## Phase 8 — Reliability and scale

- source catalog refresh strategy
- source version/update handling
- caching based on measured provider/source needs
- rate-limit policies
- observability
- performance profiling
- provider/source fallback strategy
- deployment hardening

## Non-goals for the initial MVP

- microservices;
- self-hosting copies of whole third-party catalogs;
- arbitrary URL proxying;
- social/community features;
- chat/messaging;
- custom recommendation ML models;
- native mobile apps.

These can be reconsidered after the core multi-source reader/tracker experience is stable.
