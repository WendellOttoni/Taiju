# Taiju — Development Plan

This document defines **how the project must progress**, not just what features are planned.

The goal is to keep development incremental, reviewable, and safe for AI-assisted implementation with Codex/Claude or other coding agents.

---

## 1. Development strategy

Taiju must be built through **small, technical, independently verifiable tasks**.

Each task must:

- have a single primary objective;
- define its allowed scope;
- define files/packages it may create or change;
- define explicit acceptance criteria;
- include validation steps;
- leave the repository in a working state;
- update `docs/CURRENT_STATE.md` when completed;
- never automatically continue into the next task.

The agent must prefer the simplest implementation that satisfies the current task. Do not introduce abstractions for hypothetical future requirements.

---

## 2. Project stack

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

### Planned infrastructure

- Redis for cache/rate limiting when justified
- CI with GitHub Actions
- shared runtime contracts/OpenAPI where useful

### Reading sources and external providers

Primary reading-source strategy:

- Project Nox — source-extension catalog via `index.pb`; target is support for every technically compatible published source
- MangaDex — native reading/catalog provider and first reference implementation

Metadata/anime providers:

- AniList — metadata and tracking-oriented data
- Jikan — complementary/fallback metadata
- trace.moe — anime scene identification

Project Nox modern catalog:

```text
https://github.com/Awerkori/extensoes/raw/repo/index.pb
```

Providers and sources must remain isolated from Taiju application contracts so the product can add, update, disable or replace them independently.

---

## 3. Target repository structure

```text
Taiju/
├── apps/
│   ├── web/                 # React/Vite client
│   └── api/                 # Hono/Bun backend
│
├── packages/
│   ├── contracts/           # Shared public types/schemas
│   ├── providers/           # Native external API integrations
│   ├── sources/             # Project Nox/source-extension registry + runtime
│   ├── database/            # Drizzle schema/repositories
│   └── config/              # Shared configuration/tooling
│
├── docs/
│   ├── ARCHITECTURE.md
│   ├── CURRENT_STATE.md
│   ├── ROADMAP.md
│   ├── DEVELOPMENT_PLAN.md
│   └── tasks/
│
├── AGENTS.md
├── README.md
└── package.json
```

---

## 4. Execution flow for every task

### Step 1 — Read context

Before changing code, the agent must read:

1. `README.md`
2. `AGENTS.md`
3. `docs/ARCHITECTURE.md`
4. `docs/CURRENT_STATE.md`
5. `docs/DEVELOPMENT_PLAN.md`
6. the requested `docs/tasks/TASK-XXX-*.md`

### Step 2 — Inspect current implementation

The agent must inspect only the files relevant to the requested task and existing dependencies.

It must not assume a file or feature exists just because it appears in the roadmap.

### Step 3 — Implement only the task

Do not:

- implement future tasks;
- refactor unrelated code;
- rename unrelated modules;
- introduce new infrastructure without need;
- hardcode scan/source implementations into UI or domain code;
- replace working architecture unless required by the task.

### Step 4 — Validate

At minimum, when applicable:

```bash
bun install
bun run typecheck
bun run test
bun run build
```

For backend tasks, also validate the API locally.

For frontend tasks, validate rendering and browser console behavior.

For Project Nox/source tasks, validate against deterministic catalog/source fixtures whenever possible instead of relying only on live sites.

### Step 5 — Update state

Update `docs/CURRENT_STATE.md` with:

- last completed task;
- features now available;
- known issues;
- technical decisions made;
- next planned task.

### Step 6 — Stop

The agent must report completion and stop.

It must **not start the next task** unless explicitly instructed.

---

# 5. Development phases

## Phase 0 — Foundation

Purpose: create a healthy monorepo and development baseline.

### TASK-001 — Bootstrap monorepo

Create the Bun workspace, React/Vite frontend, Hono API, shared packages and common tooling.

The target workspace must reserve a `packages/sources` package for the source engine.

Expected outcome:

```text
bun install
bun run dev
bun run typecheck
bun run build
```

work successfully.

### TASK-002 — Code quality baseline

Configure:

- formatting;
- linting;
- consistent TypeScript settings;
- workspace scripts;
- basic test runner;
- import conventions.

### TASK-003 — API foundation

Create:

- Hono application bootstrap;
- `/health` endpoint;
- environment validation with Zod;
- consistent API error response format;
- request logging baseline.

No external provider/source execution yet.

### TASK-004 — Shared contracts foundation

Establish `packages/contracts` conventions and common primitives for pagination, errors, external provenance and source identifiers.

---

## Phase 1 — Source engine and Project Nox

Purpose: make Taiju source-driven before product features become coupled to MangaDex or any individual scan.

### TASK-005 — Reading source contracts

Define the first normalized Taiju source capability contracts.

Conceptually, the source layer must be able to provide:

- source metadata;
- manga search;
- manga details;
- chapter listing;
- page resolution.

Do not expose Project Nox or any scan-specific DTO directly outside `packages/sources`.

### TASK-006 — Project Nox catalog client

Implement download/access to:

```text
https://github.com/Awerkori/extensoes/raw/repo/index.pb
```

Responsibilities:

- fetch catalog bytes;
- timeout/error handling;
- optional local development fixture;
- retain catalog provenance;
- no source execution yet.

### TASK-007 — Project Nox index decoder

Decode/parse the modern `index.pb` catalog into Taiju-owned source descriptors.

Extract all available metadata required to enumerate and version sources.

Acceptance direction:

- every catalog entry that can be decoded is represented;
- parser tests use a deterministic fixture;
- malformed entries fail in isolation when possible.

### TASK-008 — Source registry

Create a registry capable of:

- listing all Project Nox sources;
- filtering by language/capability;
- resolving a source by stable identity;
- tracking source version/provenance;
- representing compatibility/availability status.

Expose a Taiju API endpoint for source enumeration only after the internal registry is stable.

### TASK-009 — Source runtime / compatibility layer

Determine and implement the runtime/adaptation strategy required to execute compatible Project Nox extensions.

This task must begin with inspection of the Project Nox extension format and runtime expectations before implementation.

Goals:

- support all technically compatible catalog sources;
- avoid manually coding one adapter per scan when the extension format already defines the behavior;
- isolate failures per source;
- expose normalized `ReadingSource` capabilities;
- support extension/source version updates.

If Project Nox extensions target a runtime that cannot execute directly under Bun, build an explicit compatibility/adaptation boundary rather than leaking that runtime into the rest of Taiju.

---

## Phase 2 — MangaDex native reference implementation

Purpose: validate Taiju's contracts end-to-end with a stable native integration while the dynamic source runtime matures.

### TASK-010 — MangaDex HTTP client

Implement the low-level MangaDex client inside `packages/providers`.

Responsibilities:

- base URL configuration;
- request helper;
- timeout;
- cancellation where supported;
- HTTP errors;
- rate-limit metadata;
- external DTOs isolated from Taiju contracts.

### TASK-011 — Manga search contract/mapping

Map MangaDex search output into the same normalized Taiju contracts used by dynamic sources.

Do not expose MangaDex DTOs to the frontend.

### TASK-012 — Search API endpoint

Add a normalized search endpoint capable of receiving a source/provider selection.

Directional shape:

```http
GET /api/manga/search?q=...&source=...
```

The binding contract is defined by the task implementation, not by this example.

### TASK-013 — Search UI

Create the first real Taiju screen:

- search bar;
- source selection;
- debounce;
- loading state;
- error state;
- result cards;
- covers;
- responsive grid.

### TASK-014 — Manga details API

Expose normalized details through the selected source/provider.

### TASK-015 — Manga details page

Create the public details route and UI with source provenance visible when useful.

---

## Phase 3 — Multi-source chapters and reader

Purpose: make Taiju an actual multi-source reader.

### TASK-020 — Chapter feed capability

Retrieve chapters from the selected source.

Support normalized fields such as:

- language;
- pagination where relevant;
- chapter number;
- volume;
- publication timestamp;
- scanlation/source metadata where available.

### TASK-021 — Chapter API

Expose normalized chapter lists through Taiju API without leaking source runtime internals.

### TASK-022 — Chapter list UI

Add chapter browsing and source switching where multiple sources are available.

### TASK-023 — Page resolution abstraction

Define source-neutral page resolution.

For MangaDex, use MangaDex@Home behind its adapter. Dynamic Project Nox sources resolve pages through the source runtime.

### TASK-024 — Reader foundation

Create reader route and common reader state.

### TASK-025 — Vertical reader

Implement:

- continuous vertical reading;
- lazy image loading;
- image error recovery;
- chapter progress;
- next/previous chapter controls.

### TASK-026 — Paged reader

Implement optional page-by-page mode:

- keyboard navigation;
- previous/next buttons;
- preloading neighboring pages.

### TASK-027 — Reader preferences

Persist locally:

- vertical/paged mode;
- reading direction;
- image fit;
- reader UI visibility;
- preferred sources/languages where useful.

---

## Phase 4 — Database and user state

Purpose: move from stateless reader to personal product.

### TASK-030 — PostgreSQL + Drizzle foundation

Add database package and migration workflow.

### TASK-031 — User domain model

Define minimal user and profile models.

### TASK-032 — Authentication

Select and implement authentication only at this point.

### TASK-033 — Library/favorites

Allow users to save titles with external/source references.

### TASK-034 — Reading history

Store:

- title;
- source;
- chapter;
- page/progress;
- timestamp.

### TASK-035 — Reading progress synchronization

Resume reading across sessions/devices.

### TASK-036 — Source preferences

Persist preferred languages, enabled sources and optional per-title source choice.

---

## Phase 5 — Unified metadata/catalog

Purpose: enrich titles without coupling reading availability to metadata providers.

### TASK-040 — AniList client

Create isolated AniList GraphQL provider.

### TASK-041 — Unified media identifiers

Create mapping strategy between Taiju, MangaDex, Project Nox source entries and AniList IDs.

Do not assume titles alone are safe identifiers.

### TASK-042 — Rich metadata

Use AniList for complementary information where appropriate.

### TASK-043 — Jikan fallback provider

Use only when useful for data missing elsewhere.

### TASK-044 — Provider/source resolution layer

The rest of Taiju should request capabilities, not hardcode a particular third-party provider or scan.

---

## Phase 6 — Anime companion

### TASK-050 — Anime catalog

Expose anime search/details through AniList/Jikan.

### TASK-051 — Anime tracking

Users can track planning/watching/completed/paused/dropped state.

### TASK-052 — Streaming links metadata

Display provider links when supplied by metadata services.

### TASK-053 — trace.moe integration

Identify anime scenes from screenshots.

### TASK-054 — Scene finder UI

Build the corresponding user experience.

---

## Phase 7 — Discovery

### TASK-060 — Trending pages
### TASK-061 — Seasonal anime
### TASK-062 — Recommendations
### TASK-063 — Advanced filtering
### TASK-064 — Search history and recent titles

---

## Phase 8 — Performance and resilience

### TASK-070 — Cache strategy

Measure expensive/high-volume provider and source catalog operations first.

### TASK-071 — Redis

Add only when required by measured needs.

### TASK-072 — Provider/source rate-limit protection

Implement per-upstream policies.

### TASK-073 — Source catalog update strategy

Handle Project Nox catalog refresh, extension version changes, stale descriptors and compatibility status.

### TASK-074 — Resilience

Add carefully scoped retries/backoff only for safe requests and isolate broken sources.

### TASK-075 — Observability

Add structured logs and operational metrics including source-level failure diagnostics.

---

## Phase 9 — Delivery

### TASK-080 — CI

GitHub Actions should run install, lint, typecheck, tests and production build.

### TASK-081 — Container/deployment decision

Choose deployment based on actual runtime needs, especially the final Project Nox compatibility/runtime strategy.

### TASK-082 — Production environments

Separate development/staging/production configuration.

### TASK-083 — taiju.app deployment

Configure the final public deployment and domain when infrastructure is ready.

---

# 6. Task numbering policy

```text
000–004  foundation
005–009  source engine / Project Nox
010–019  MangaDex/reference discovery
020–029  reader
030–039  users/database
040–049  metadata/multi-provider
050–059  anime
060–069  discovery
070–079  performance/infrastructure
080–089  delivery
090–099  reserved
```

If a task grows too large, split it into the next available small task rather than asking an agent to complete a broad feature in one pass.

---

# 7. Definition of Done

A task is only complete when all applicable conditions are true:

- requested behavior exists;
- typecheck passes;
- tests pass;
- production build passes;
- no new known console/runtime errors;
- code outside scope was not unnecessarily modified;
- external DTO/runtime details do not leak across provider/source boundaries;
- one broken source cannot crash unrelated source operations where isolation applies;
- documentation reflects meaningful architectural changes;
- `CURRENT_STATE.md` is updated;
- agent reports files created/changed and validation performed.

---

# 8. Review workflow

```text
1. Choose exactly one TASK
        ↓
2. Codex implements it
        ↓
3. Human/ChatGPT reviews diff and architecture
        ↓
4. Fix only issues found in that task
        ↓
5. Validate
        ↓
6. Mark task complete in CURRENT_STATE
        ↓
7. Prepare next TASK
```

Do not feed the entire roadmap to an agent as an instruction to implement everything.

The roadmap provides context. The task file provides authority.

---

# 9. Standard prompt for Codex

```text
Read README.md, AGENTS.md, docs/ARCHITECTURE.md,
docs/CURRENT_STATE.md, docs/DEVELOPMENT_PLAN.md and the requested task file.

Execute only TASK-XXX.

Respect its scope, technical constraints, acceptance criteria and validation steps.
Do not implement future tasks and do not refactor unrelated code.

Before finishing:
- run all applicable validations;
- correct errors introduced by the task;
- update docs/CURRENT_STATE.md;
- report files created/changed, tests performed and known issues.

Stop after TASK-XXX is complete.
```

---

# 10. Immediate next steps

Current recommended order:

```text
TASK-001  Bootstrap monorepo
   ↓
TASK-002  Code quality baseline
   ↓
TASK-003  API foundation
   ↓
TASK-004  Shared contracts foundation
   ↓
TASK-005  Reading source contracts
   ↓
TASK-006  Project Nox catalog client
   ↓
TASK-007  Project Nox index decoder
   ↓
TASK-008  Source registry
   ↓
TASK-009  Source runtime / compatibility layer
   ↓
TASK-010  MangaDex native reference client
   ↓
TASK-011  MangaDex normalized mapping
   ↓
TASK-012  Multi-source search endpoint
   ↓
TASK-013  Search UI with source selection
```

### Milestone A — Source catalog

Complete when Taiju can load the Project Nox `index.pb`, enumerate all decoded sources and expose compatibility/availability information.

### Milestone B — First dynamic source

Complete when at least one Project Nox extension can execute through Taiju's source runtime and perform normalized search/details/chapter/page operations.

### Milestone C — Multi-source reader

Complete when the user can choose among available sources, open a title, select a chapter and read it inside Taiju through the common source interface.

---

## Guiding principle

> Build one small verified capability at a time. Treat Project Nox as a dynamic source registry, not as product/domain code, and keep every source behind the same Taiju-owned contracts.
