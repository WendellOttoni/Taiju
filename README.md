# Taiju

Taiju is an open-source manga, manhwa and manhua reader and anime companion.

The project is built **source-first**: catalog, reading, tracking and discovery must not depend on a single provider. The primary reading architecture is the Taiju Source Engine, backed initially by the full Project Nox extension catalog.

> Status: foundation phase. No product features have been implemented yet.

## Product vision

Taiju aims to provide a clean place to discover, read and track Asian comics while also acting as an anime companion.

Planned capabilities include:

- search and discovery for manga, manhwa and manhua;
- title details, covers, tags, authors and publication information;
- chapter browsing and reading through multiple sources;
- source selection per title/chapter;
- loading the complete Project Nox extension catalog and exposing every technically compatible source through a normalized Taiju source interface;
- cross-source search and availability;
- vertical and page-by-page reading modes;
- reading history, favorites and progress tracking;
- anime metadata, seasonal discovery and tracking;
- recommendations and related titles;
- identification of anime scenes from screenshots;
- metadata providers isolated behind Taiju-owned contracts.

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

### Reading sources

Taiju does not have a privileged default reading source.

The first source ecosystem is:

- Project Nox — source-extension catalog via `index.pb`

Catalog:

```text
https://github.com/Awerkori/extensoes/raw/repo/index.pb
```

The goal is to support **all Project Nox sources that are technically compatible with the Taiju source runtime**, rather than maintaining a curated or hardcoded subset.

For the first usable milestone, Taiju prioritizes sources that provide Brazilian Portuguese (`pt-BR`) or English (`en`). This is a rollout priority, not a hardcoded source allowlist: source identity, language and availability remain visible and configurable.

MangaDex, when available through the supported source ecosystem or through a future dedicated adapter, is treated as just another source from the product's point of view.

### Metadata/anime providers
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
│   ├── sources/              # source catalog, registry, runtime and adapters
│   ├── providers/            # non-reading metadata/anime integrations
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

## Architecture principles

1. Taiju owns its public contracts. External source/provider DTOs must not leak into the web app.
2. Reading is source-engine driven from the beginning.
3. No scan/site is hardcoded into product or UI logic.
4. Project Nox is an external source registry/catalog, not Taiju's domain model.
5. Every reading source is exposed through the same normalized capability contract.
6. Search, details, chapters and pages must operate by source capability, not by source name.
7. One broken source must not break unrelated sources.
8. Metadata providers are independent from reading sources.
9. Features are implemented incrementally in small, testable tasks.
10. A completed task must leave the repository runnable and validated.

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

Taiju is an independent project and is not affiliated with Project Nox, individual source sites, publishers or rights holders. Source availability may change over time, so integrations must be isolated, updateable and failure-tolerant.

## License

This repository is licensed under the terms in [`LICENSE`](LICENSE).
