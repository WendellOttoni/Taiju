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
- OpenAPI or shared contracts where useful

### External providers

Initial providers:

- MangaDex — reading/catalog provider
- AniList — metadata and tracking-oriented data
- Jikan — complementary/fallback metadata
- trace.moe — anime scene identification

Providers must remain isolated from domain/application contracts so Taiju can replace or add providers later.

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
│   ├── providers/           # External API integrations
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
5. the requested `docs/tasks/TASK-XXX-*.md`

### Step 2 — Inspect current implementation

The agent must inspect only the files relevant to the requested task and existing dependencies.

It must not assume a file or feature exists just because it appears in the roadmap.

### Step 3 — Implement only the task

Do not:

- implement future tasks;
- refactor unrelated code;
- rename unrelated modules;
- introduce new infrastructure without need;
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

No external provider yet.

---

## Phase 1 — MangaDex integration

Purpose: achieve the first end-to-end useful feature.

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

### TASK-011 — Manga search contract

Define normalized Taiju contracts for manga search.

Do not expose MangaDex DTOs to the frontend.

Example concept:

```ts
type MangaSummary = {
  id: string
  title: string
  description?: string
  coverUrl?: string
  status?: string
  originalLanguage?: string
  tags: string[]
}
```

### TASK-012 — Search API endpoint

Add:

```http
GET /api/manga/search?q=...
```

Flow:

```text
Web/API request
   ↓
Taiju service
   ↓
MangaDex provider
   ↓
normalization
   ↓
Taiju response contract
```

### TASK-013 — Search UI

Create the first real Taiju screen:

- search bar;
- debounce;
- loading state;
- error state;
- result cards;
- covers;
- responsive grid.

### TASK-014 — Manga details API

Expose normalized details:

- title;
- alternative titles;
- description;
- authors/artists;
- tags;
- publication status;
- available languages;
- cover.

### TASK-015 — Manga details page

Create the public details route and UI.

---

## Phase 2 — Chapters and reader

Purpose: make Taiju an actual reader.

### TASK-020 — Chapter feed provider

Retrieve chapters for a selected manga.

Support at minimum:

- language filtering;
- pagination;
- chapter number;
- volume;
- publication timestamp;
- scanlation group metadata where available.

### TASK-021 — Chapter API

Expose normalized chapter lists through Taiju API.

### TASK-022 — Chapter list UI

Add chapter browsing to manga details.

### TASK-023 — MangaDex@Home page resolver

Implement page resolution for an individual chapter.

Keep the MangaDex delivery protocol isolated inside the provider package.

### TASK-024 — Reader foundation

Create reader route and common reader state.

No advanced modes yet.

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
- reader UI visibility.

---

## Phase 3 — Database and user state

Purpose: move from stateless reader to personal product.

### TASK-030 — PostgreSQL + Drizzle foundation

Add database package and migration workflow.

Do not add user authentication yet.

### TASK-031 — User domain model

Define minimal user and profile models.

### TASK-032 — Authentication

Select and implement authentication only at this point.

Requirements should be decided in the task itself after evaluating current options.

### TASK-033 — Library/favorites

Allow users to save titles.

### TASK-034 — Reading history

Store:

- manga;
- chapter;
- page/progress;
- timestamp.

### TASK-035 — Reading progress synchronization

Resume reading across sessions/devices.

---

## Phase 4 — Multi-provider catalog

Purpose: separate Taiju from dependence on one catalog.

### TASK-040 — AniList client

Create isolated AniList GraphQL provider.

### TASK-041 — Unified media identifiers

Create mapping strategy between Taiju, MangaDex and AniList IDs.

Do not assume titles alone are safe identifiers.

### TASK-042 — Rich metadata

Use AniList for complementary information where appropriate:

- popularity;
- scores;
- relations;
- anime adaptations;
- recommendations;
- characters when useful.

### TASK-043 — Jikan fallback provider

Use only when useful for data missing elsewhere.

### TASK-044 — Provider resolution layer

The rest of Taiju should request data by capability, not by hardcoding a particular third-party provider.

Conceptually:

```text
CatalogService
├── MangaDex
├── AniList
└── Jikan
```

---

## Phase 5 — Anime companion

Purpose: expand Taiju without turning it into an unauthorized video host.

### TASK-050 — Anime catalog

Expose anime search/details through AniList/Jikan.

### TASK-051 — Anime tracking

Users can track:

- planning;
- watching;
- completed;
- paused;
- dropped.

### TASK-052 — Legal streaming links

Display provider links when supplied by metadata services.

### TASK-053 — trace.moe integration

Upload/select screenshot and identify:

- anime;
- episode;
- approximate timestamp;
- confidence/match information.

### TASK-054 — Scene finder UI

Build the corresponding user experience.

---

## Phase 6 — Discovery

Purpose: improve product value beyond simple reading.

### TASK-060 — Trending pages

### TASK-061 — Seasonal anime

### TASK-062 — Recommendations

Start with provider-native recommendation data.

### TASK-063 — Advanced filtering

Examples:

- manga/manhwa/manhua;
- genre;
- publication status;
- language;
- demographic;
- year.

### TASK-064 — Search history and recent titles

---

## Phase 7 — Performance and resilience

Only introduce infrastructure once actual behavior justifies it.

### TASK-070 — Cache strategy

Identify expensive/high-volume external requests first.

Then introduce cache.

### TASK-071 — Redis

Add Redis only if required by measured requirements such as shared cache, sessions or rate limiting.

### TASK-072 — Provider rate-limit protection

Implement per-provider policies.

### TASK-073 — Resilience

Add carefully scoped retries/backoff only for safe requests.

### TASK-074 — Observability

Add structured logs and operational metrics.

---

## Phase 8 — Delivery

### TASK-080 — CI

GitHub Actions should run:

- install;
- lint;
- typecheck;
- tests;
- production build.

### TASK-081 — Container/deployment decision

Choose deployment based on actual runtime needs instead of forcing Docker early.

### TASK-082 — Production environments

Separate development/staging/production configuration.

### TASK-083 — taiju.app deployment

Configure the final public deployment and domain when infrastructure is ready.

---

# 6. Task numbering policy

Use ranges by domain so new tasks can be inserted without renumbering the project:

```text
000–009  foundation
010–019  MangaDex/catalog
020–029  reader
030–039  users/database
040–049  multi-provider
050–059  anime
060–069  discovery
070–079  performance/infrastructure
080–089  delivery
090–099  reserved
```

If a task grows too large, split it:

```text
TASK-023
TASK-023A
TASK-023B
```

or preferably allocate the next unused integer if no compatibility reason exists.

---

# 7. Definition of Done

A task is only complete when all applicable conditions are true:

- requested behavior exists;
- typecheck passes;
- tests pass;
- production build passes;
- no new known console/runtime errors;
- code outside scope was not unnecessarily modified;
- external DTOs do not leak across provider boundaries;
- documentation reflects meaningful architectural changes;
- `CURRENT_STATE.md` is updated;
- agent reports files created/changed and validation performed.

---

# 8. Review workflow

Recommended AI-assisted workflow:

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

Use this pattern for normal tasks:

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
Review
   ↓
TASK-002  Code quality baseline
   ↓
Review
   ↓
TASK-003  API foundation
   ↓
Review
   ↓
TASK-010  MangaDex client
   ↓
TASK-011  Normalized manga contracts
   ↓
TASK-012  Manga search endpoint
   ↓
TASK-013  Search UI
```

The first milestone is complete when a user can open Taiju, search for a manga and receive real normalized MangaDex results through the Taiju backend.

The second milestone is complete when a user can open a title, select an available chapter and read it inside Taiju.

---

## Guiding principle

> Build one small verified capability at a time. The project should be usable and understandable after every completed task.
