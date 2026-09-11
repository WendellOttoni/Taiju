# Taiju Roadmap

This roadmap is directional. Numbered task files define executable scope.

## Phase 0 — Foundation

- TASK-001 — bootstrap Bun monorepo
- TASK-002 — establish shared contracts package
- TASK-003 — establish source/provider package conventions
- TASK-004 — add CI quality checks

## Phase 1 — Source Engine + Project Nox

This is the first product foundation. No individual reading source is privileged.

- define normalized Taiju reading-source contracts
- add `packages/sources`
- download Project Nox repository metadata
- parse/decode Project Nox `index.pb`
- enumerate all catalog extensions/sources
- retain source name, language, version, package identity and provenance
- define compatibility checks
- determine extension runtime requirements
- build source runtime / compatibility layer
- expose available sources through Taiju API
- isolate failures per source
- support source updates/version changes

Primary catalog:

```text
https://github.com/Awerkori/extensoes/raw/repo/index.pb
```

Goal: Taiju should expose **every technically compatible Project Nox source**, not a curated subset and not a MangaDex-first path.

Initial language priority:

- Brazilian Portuguese (`pt-BR`);
- English (`en`);
- other languages remain discoverable metadata but are not part of the first reader milestone.

## Phase 2 — Multi-source discovery

- source enumeration API
- search one selected source
- search all enabled sources
- normalized manga search contract
- source provenance in results
- source/language filtering
- `pt-BR`/`en` preference ordering and explicit fallback
- search UI
- manga details through selected source
- cover rendering
- pagination/error/loading states
- source failure isolation
- initial cross-source duplicate/matching strategy

## Phase 3 — Multi-source chapters and reader

- chapter listing from any compatible source
- source switching per title
- language filters
- source-neutral page resolution
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
- preferred languages
- per-title source choices

## Phase 5 — Unified metadata/catalog

- AniList integration
- cross-source title identity strategy
- rich metadata enrichment
- Jikan fallback/complementary metadata
- source/provider resolution layer
- relationships between manga/manhwa/manhua and anime entries

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
- cross-media relationships
- source-aware availability indicators

## Phase 8 — Reliability and scale

- Project Nox catalog refresh strategy
- source version/update handling
- caching based on measured source/provider needs
- source-level rate-limit policies
- observability
- performance profiling
- source fallback strategy
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
