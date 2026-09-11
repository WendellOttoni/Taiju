# Taiju

Taiju is an open-source manga, manhwa and manhua reader and anime companion.

The project is being built around a provider-based architecture so that catalog, reading, tracking and discovery features are not tied to a single external service. The first reading provider will be MangaDex; anime and metadata integrations are planned through services such as AniList, Jikan and trace.moe.

> Status: foundation phase. No product features have been implemented yet.

## Product vision

Taiju aims to provide a clean place to discover, read and track Asian comics while also acting as an anime companion.

Planned capabilities include:

- search and discovery for manga, manhwa and manhua;
- title details, covers, tags, authors and publication information;
- chapter browsing and reading when a configured provider makes the content available;
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

### External providers
- MangaDex — initial reading and manga metadata provider
- AniList — planned catalog/anime metadata provider
- Jikan — planned complementary/fallback metadata provider
- trace.moe — planned anime scene identification provider

## Repository architecture

```text
Taiju/
├── apps/
│   ├── api/                  # Hono/Bun HTTP application
│   └── web/                  # React/Vite application
├── packages/
│   ├── contracts/            # shared schemas and public contracts
│   ├── database/             # Drizzle schema, migrations and DB access
│   ├── providers/            # external provider integrations
│   └── config/               # shared TypeScript/tooling configuration
├── docs/
│   ├── ARCHITECTURE.md
│   ├── CURRENT_STATE.md
│   ├── ROADMAP.md
│   └── tasks/
├── AGENTS.md
├── package.json
└── README.md
```

The initial structure is intentionally small. New abstractions should only be introduced when a concrete feature requires them.

## Architecture principles

1. Taiju owns its public contracts. External API DTOs must not leak directly into the web app.
2. External services are providers, not the domain model.
3. Features are implemented incrementally in small, testable tasks.
4. Frontend and backend share TypeScript contracts where useful.
5. Provider failures must be isolated and translated into Taiju-level errors.
6. Caching and persistence are introduced based on measured requirements, not preemptively.
7. No unrelated refactoring during feature tasks.
8. A completed task should leave the repository in a runnable, validated state.

See [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) for the technical direction and [`AGENTS.md`](AGENTS.md) for agent-development rules.

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

## Legal and provider note

Taiju is an independent project and is not affiliated with MangaDex, AniList, MyAnimeList, Tokyo Revengers or their respective publishers and rights holders. Availability of third-party content depends on each provider and may vary by title, language, region and time. Integrations must respect provider terms and applicable rights.

## License

This repository is licensed under the terms in [`LICENSE`](LICENSE).
