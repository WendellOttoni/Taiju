# Taiju

Taiju is an open-source manga, manhwa and manhua reader and anime companion.

The project is built around a provider/source architecture so catalog, reading, tracking and discovery features are not tied to a single external service. Taiju will support native providers such as MangaDex and a source-extension layer backed by the Project Nox repository catalog.

> Status: foundation phase. No product features have been implemented yet.

## Product vision

Taiju aims to provide a clean place to discover, read and track Asian comics while also acting as an anime companion.

Planned capabilities include:

- search and discovery for manga, manhwa and manhua;
- title details, covers, tags, authors and publication information;
- chapter browsing and reading through multiple configured sources;
- source selection per title/chapter;
- loading the full Project Nox extension catalog and exposing compatible sources through a normalized Taiju source interface;
- vertical and page-by-page reading modes;
- reading history, favorites and progress tracking;
- anime metadata, seasonal discovery and tracking;
- recommendations and related titles;
- identification of anime scenes from screenshots;
- multiple external providers behind normalized Taiju contracts.

## Tech stack

### Web
- React
- Vite
- TypeScript
- Tailwind CSS
- shadcn/ui

### API
- Bun
- Hono
- TypeScript
- Zod

### Data
- PostgreSQL
- Drizzle ORM
- Redis may be introduced later when caching requirements justify it

### External providers and source catalogs
- Project Nox — primary source-extension catalog; Taiju will ingest its modern `index.pb` catalog and support all compatible published sources/extensions
- MangaDex — native reading and manga metadata provider and initial reference implementation
- AniList — planned catalog/anime metadata provider
- Jikan — planned complementary/fallback metadata provider
- trace.moe — planned anime scene identification provider

Project Nox catalog:

```text
https://github.com/Awerkori/extensoes/raw/repo/index.pb
```

Taiju must not hardcode individual scan sites into product/domain code. Each source must be reached through a common source contract so sources can be added, updated, disabled or replaced independently.

## Repository architecture

```text
Taiju/
├── apps/
│   ├── api/                  # Hono/Bun HTTP application
│   └── web/                  # React/Vite application
├── packages/
│   ├── contracts/            # shared schemas and public contracts
│   ├── database/             # Drizzle schema, migrations and DB access
│   ├── providers/            # native external provider integrations
│   ├── sources/              # Project Nox/source-extension runtime and adapters
│   └── config/               # shared TypeScript/tooling configuration
├── docs/
│   ├── ARCHITECTURE.md
│   ├── CURRENT_STATE.md
│   ├── ROADMAP.md
│   ├── DEVELOPMENT_PLAN.md
│   └── tasks/
├── AGENTS.md
├── package.json
└── README.md
```

The initial structure is intentionally small. New abstractions should only be introduced when a concrete feature requires them.

## Architecture principles

1. Taiju owns its public contracts. External API/source DTOs must not leak directly into the web app.
2. External services and scan sources are adapters, not the domain model.
3. Project Nox is treated as a source registry/catalog, not as Taiju's domain representation.
4. Every reading source must implement a normalized capability contract.
5. Features are implemented incrementally in small, testable tasks.
6. Frontend and backend share TypeScript contracts where useful.
7. Provider/source failures must be isolated and translated into Taiju-level errors.
8. Caching and persistence are introduced based on measured requirements, not preemptively.
9. No unrelated refactoring during feature tasks.
10. A completed task should leave the repository in a runnable, validated state.

See [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) for the technical direction, [`docs/DEVELOPMENT_PLAN.md`](docs/DEVELOPMENT_PLAN.md) for execution order and [`AGENTS.md`](AGENTS.md) for agent-development rules.

## Development workflow

Development is organized into numbered technical tasks. Each task has a narrow scope, explicit constraints and acceptance criteria.

The current project state is tracked in [`docs/CURRENT_STATE.md`](docs/CURRENT_STATE.md), while the planned milestones live in [`docs/ROADMAP.md`](docs/ROADMAP.md).

The first executable task is [`TASK-001`](docs/tasks/TASK-001-bootstrap.md).

## Local requirements

The implementation phase will require:

- Bun
- Git
- PostgreSQL
- a modern Node-compatible editor/toolchain

Exact version constraints will be pinned during TASK-001 rather than guessed in advance.

## Project independence

Taiju is an independent project and is not affiliated with Project Nox, MangaDex, AniList, MyAnimeList, Tokyo Revengers or their respective publishers and rights holders. Source availability may change over time, so source integrations must be isolated, updateable and failure-tolerant.

## License

This repository is licensed under the terms in [`LICENSE`](LICENSE).
