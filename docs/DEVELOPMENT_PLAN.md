# Taiju — Development Plan

This document defines how Taiju must progress technically.

Taiju is **multi-source by design**. No reading source is a privileged first-class path in product code. The initial reading ecosystem is the Project Nox catalog, and the goal is to support every source that is technically compatible with the Taiju runtime.

---

## 1. Development strategy

Taiju must be implemented through small, independently verifiable tasks.

Each task must:

- have one primary objective;
- define allowed scope;
- define explicit acceptance criteria;
- include validation steps;
- leave the repository runnable;
- update `docs/CURRENT_STATE.md` when completed;
- stop without automatically starting the next task.

Do not introduce abstractions for hypothetical requirements, except for the source boundary itself, which is a core product requirement from day one.

---

## 2. Stack

### Frontend
- React
- Vite
- TypeScript
- Tailwind CSS
- shadcn/ui

### Backend
- Bun
- Hono
- TypeScript
- Zod

### Data
- PostgreSQL
- Drizzle ORM

### Reading source ecosystem
- Taiju Source Engine
- Project Nox catalog via `index.pb`
- source registry
- source runtime / compatibility layer

Project Nox catalog:

```text
https://github.com/Awerkori/extensoes/raw/repo/index.pb
```

### Initial language scope

The first usable source slice prioritizes Brazilian Portuguese (`pt-BR`) and English (`en`). This must be implemented as language-aware ordering and filtering over source metadata, never as a hardcoded list of sites. Other compatible languages may be cataloged, but they do not block the initial reader milestone.

Required behavior:

1. normalize catalog locale aliases to stable Taiju language codes;
2. preserve source language and provenance in every descriptor/result;
3. allow a user preference order with `pt-BR` and `en` as the initial options;
4. fall back only when the preferred language has no compatible source/result;
5. show source availability and language explicitly in discovery and reader flows.

### Metadata/anime providers
- AniList
- Jikan
- trace.moe

Redis may be added later only when measured caching/rate-limit needs justify it.

---

## 3. Target repository structure

```text
Taiju/
├── apps/
│   ├── web/
│   └── api/
├── packages/
│   ├── contracts/
│   ├── sources/
│   ├── providers/
│   ├── database/
│   └── config/
├── docs/
│   ├── ARCHITECTURE.md
│   ├── CURRENT_STATE.md
│   ├── ROADMAP.md
│   ├── DEVELOPMENT_PLAN.md
│   └── tasks/
├── AGENTS.md
├── README.md
└── package.json
```

`packages/sources` is the central reading integration layer.

---

## 4. Rules for source architecture

1. Product/UI code must never hardcode a scan/source implementation.
2. All reading sources must be represented through Taiju-owned contracts.
3. Project Nox catalog structures must remain internal to `packages/sources`.
4. Search, details, chapters and pages are capabilities, not source-specific features.
5. A dedicated/native adapter, if ever needed, must implement the same source contract as dynamic sources.
6. One broken source must not break unrelated sources.
7. Source provenance must remain explicit in IDs/results.
8. Source runtime details must not leak into API/public contracts.
9. Cross-source matching must not rely only on title text.
10. No source becomes the default merely because it was implemented first.

---

## 5. Task execution flow

Before each task the agent must read:

1. `README.md`
2. `AGENTS.md`
3. `docs/ARCHITECTURE.md`
4. `docs/CURRENT_STATE.md`
5. `docs/DEVELOPMENT_PLAN.md`
6. requested `docs/tasks/TASK-XXX-*.md`

Then:

```text
inspect relevant code
   ↓
implement one task only
   ↓
run validations
   ↓
fix regressions introduced by the task
   ↓
update CURRENT_STATE.md
   ↓
report and stop
```

Normal validation, when applicable:

```bash
bun install
bun run typecheck
bun run test
bun run build
```

Live third-party sites must not be required for normal CI; use deterministic fixtures/mocks for source engine tests.

---

# 6. Phases and tasks

## Phase 0 — Foundation

### TASK-001 — Bootstrap monorepo

Create Bun workspace, React/Vite app, Hono API and packages:

```text
contracts
sources
providers
database
config
```

No external source logic yet.

### TASK-002 — Code quality baseline

Configure linting, formatting, TypeScript consistency, tests and workspace scripts.

### TASK-003 — API foundation

Create Hono bootstrap, `/health`, environment validation, API error shape and request logging baseline.

### TASK-004 — Shared contracts foundation

Create common Taiju primitives for:
- errors;
- pagination;
- source identity;
- provenance;
- capability metadata.

---

## Phase 1 — Project Nox catalog and source engine

### TASK-005 — Reading source capability contracts

Define normalized contracts for:
- source metadata;
- search;
- manga details;
- chapter listing;
- page resolution.

### TASK-006 — Project Nox catalog client

Fetch the raw `index.pb` bytes with timeout/error handling and deterministic local fixture support.

### TASK-007 — Project Nox index decoder

Decode the catalog into Taiju-owned source descriptors.

Acceptance goals:
- enumerate every decodable catalog entry;
- preserve source/package/version/language/provenance metadata;
- isolate malformed entries when possible;
- parser tests use fixtures.

### TASK-008 — Source registry

Create registry functionality for:
- list all sources;
- filter by language;
- resolve stable source identity;
- retain version/provenance;
- compatibility status;
- enabled/disabled state representation.

### TASK-009 — Source runtime investigation

Before implementation, inspect the Project Nox extension format and upstream source project to determine:
- compiled artifact/runtime type;
- APIs expected by extensions;
- whether direct Bun execution is possible;
- whether a compatibility process/service/runtime is required;
- update/signature model.

This task produces a documented technical decision and proof-of-concept plan. Do not guess the runtime.

### TASK-010 — Source runtime foundation

Implement the runtime/compatibility boundary selected by TASK-009.

The rest of Taiju must see only normalized source capabilities.

### TASK-011 — First real extension execution

Execute one real Project Nox source end-to-end solely as a **runtime validation fixture**.

This source is not a preferred/default source; it is just the first compatibility test.

Validate:
- source loads;
- search works;
- details work;
- chapters work;
- page resolution works when supported.

### TASK-012 — Catalog-wide compatibility scanner

Evaluate all Project Nox catalog entries against the Taiju runtime and classify:
- compatible;
- incompatible;
- broken/upstream unavailable;
- update required;
- unsupported runtime feature.

Do not manually maintain a whitelist unless technically unavoidable and documented.

---

## Phase 2 — Multi-source API and discovery

### TASK-013 — Sources API

Expose source enumeration through Taiju API.

Directional example:

```http
GET /api/sources
```

### TASK-014 — Single-source search API

Search any selected compatible source using the same endpoint/contract.

### TASK-015 — Multi-source search orchestration

Allow searching all enabled/selected sources with bounded concurrency, timeouts and isolated failures.

### TASK-016 — Search result normalization

Return source-neutral manga results with explicit provenance.

### TASK-017 — Search UI

Create:
- search input;
- source selector;
- language filter;
- all-sources mode;
- loading/error states;
- grouped or normalized results;
- source provenance.

### TASK-018 — Manga details API

Expose details through any selected source.

### TASK-019 — Manga details UI

Show metadata plus source availability/provenance.

---

## Phase 3 — Chapters and reader

### TASK-020 — Multi-source chapter API

Retrieve normalized chapters from any source.

### TASK-021 — Chapter list UI

Support source/language selection and chapter browsing.

### TASK-022 — Source-neutral page resolution

Resolve reader pages through the selected source runtime.

### TASK-023 — Reader foundation

Create common reader state independent of source implementation.

### TASK-024 — Vertical reader

Implement continuous vertical reading and lazy image loading.

### TASK-025 — Paged reader

Implement page-by-page mode, keyboard navigation and neighboring-page preload.

### TASK-026 — Reader preferences

Persist local reading mode, direction, fit and preferred languages/sources.

### TASK-027 — Source switch / fallback UX

Allow changing source when multiple sources expose equivalent content without hiding provenance.

---

## Phase 4 — Persistence and accounts

### TASK-030 — PostgreSQL + Drizzle
### TASK-031 — User model
### TASK-032 — Authentication
### TASK-033 — Library/favorites
### TASK-034 — Reading history
### TASK-035 — Reading progress synchronization
### TASK-036 — Source/language preferences

Persist source-aware references rather than assuming one canonical external ID.

---

## Phase 5 — Metadata enrichment

### TASK-040 — AniList client
### TASK-041 — Cross-source/media identity strategy
### TASK-042 — Rich metadata enrichment
### TASK-043 — Jikan fallback/complement
### TASK-044 — Capability/provider resolution layer

Metadata providers enrich titles but do not become reading sources by default.

---

## Phase 6 — Anime companion

### TASK-050 — Anime catalog
### TASK-051 — Anime tracking
### TASK-052 — Streaming-link metadata
### TASK-053 — trace.moe integration
### TASK-054 — Scene finder UI

---

## Phase 7 — Discovery

### TASK-060 — Trending
### TASK-061 — Seasonal anime
### TASK-062 — Recommendations
### TASK-063 — Advanced filtering
### TASK-064 — Search history/recent titles

---

## Phase 8 — Reliability and scale

### TASK-070 — Source catalog refresh strategy
### TASK-071 — Source update/version handling
### TASK-072 — Cache strategy
### TASK-073 — Redis if justified
### TASK-074 — Rate-limit/concurrency protection
### TASK-075 — Source isolation and resilience
### TASK-076 — Observability

---

## Phase 9 — Delivery

### TASK-080 — CI
### TASK-081 — Runtime/deployment decision
### TASK-082 — Production environments
### TASK-083 — taiju.app deployment

The deployment decision must account for whatever runtime is required to execute Project Nox extensions.

---

# 7. Milestones

## Milestone A — Catalog

Taiju downloads and decodes `index.pb` and lists all Project Nox sources.

## Milestone B — Runtime

Taiju can execute Project Nox extensions through one normalized source contract.

## Milestone C — All-source discovery

A user can search one source or all enabled compatible sources through the same Taiju API/UI.

## Milestone D — Reader

A user can choose a result/source, open chapters and read content through the common reader.

## Milestone E — Personal product

Favorites, history, progress and preferences persist across sessions.

---

# 8. Definition of Done

A task is complete only when applicable conditions pass:

- requested behavior exists;
- typecheck passes;
- tests pass;
- production build passes;
- no new known runtime/console errors;
- scope was respected;
- source/runtime details do not leak across boundaries;
- source failures are isolated where applicable;
- docs reflect architectural decisions;
- `CURRENT_STATE.md` is updated;
- files changed and validation performed are reported.

---

# 9. Standard Codex prompt

```text
Read README.md, AGENTS.md, docs/ARCHITECTURE.md,
docs/CURRENT_STATE.md, docs/DEVELOPMENT_PLAN.md and the requested task file.

Execute only TASK-XXX.

Respect its scope, technical constraints, acceptance criteria and validation steps.
Do not implement future tasks and do not refactor unrelated code.
Do not introduce source-specific behavior into product/domain/UI code.

Before finishing:
- run all applicable validations;
- correct errors introduced by the task;
- update docs/CURRENT_STATE.md;
- report files created/changed, tests performed and known issues.

Stop after TASK-XXX is complete.
```

---

# 10. Immediate order

```text
TASK-001  Bootstrap monorepo
TASK-002  Code quality baseline
TASK-003  API foundation
TASK-004  Shared contracts foundation
TASK-005  Reading source contracts
TASK-006  Project Nox catalog client
TASK-007  Project Nox index decoder
TASK-008  Source registry
TASK-009  Runtime investigation
TASK-010  Runtime foundation
TASK-011  First extension runtime validation
TASK-012  Catalog-wide compatibility scanner
TASK-013  Sources API
TASK-014  Single-source search
TASK-015  Multi-source search
TASK-016  Search normalization
TASK-017  Search UI
```

> Build the engine for all sources first; product features consume the engine afterward.
