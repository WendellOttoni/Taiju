# TASK-001 — Bootstrap the monorepo

## Context

Taiju is an open-source manga, manhwa and manhua reader and anime companion.

Selected stack:
- Bun
- TypeScript
- Hono
- React
- Vite
- Tailwind CSS
- shadcn/ui
- Zod
- PostgreSQL
- Drizzle ORM

Read before implementing:
- `README.md`
- `AGENTS.md`
- `docs/ARCHITECTURE.md`
- `docs/CURRENT_STATE.md`

## Objective

Create only the runnable monorepo foundation. Do not implement product features or external provider integrations.

## Required workspace structure

```text
apps/
├── api/
└── web/

packages/
├── contracts/
├── providers/
├── database/
└── config/
```

## Root workspace

Configure Bun workspaces for `apps/*` and `packages/*`.

Add root scripts sufficient for development and validation, such as:
- `dev`
- `dev:web`
- `dev:api`
- `build`
- `typecheck`
- `test`
- `lint` if a linter is introduced

Do not add scripts that are knowingly broken.

## API app

Create `apps/api` using Hono and Bun.

Requirements:
- TypeScript strict mode;
- minimal application bootstrap;
- `GET /health` returning a small JSON response;
- no database dependency yet;
- no MangaDex integration yet;
- no authentication;
- no placeholder business services.

Expected example response:

```json
{
  "status": "ok",
  "service": "taiju-api"
}
```

Exact formatting is flexible, but the endpoint must be deterministic and testable.

## Web app

Create `apps/web` using React + Vite + TypeScript.

Requirements:
- clean starter screen branded as Taiju;
- Tailwind CSS configured;
- prepare shadcn/ui in the supported way for the selected versions;
- no manga UI yet;
- no external API calls yet;
- no mock catalog data.

The screen should communicate that Taiju is a manga/manhwa/manhua reader and anime companion, but remain intentionally minimal.

## Contracts package

Create the package boundary but do not invent product domain contracts yet.

A minimal package entrypoint is sufficient.

## Providers package

Create the package boundary only.

Do not implement MangaDex or any provider in this task.

## Database package

Create the package boundary and prepare Drizzle dependencies/configuration only if it can be done without requiring a live database.

Do not create speculative user/manga tables.

If a Drizzle configuration would require inventing schema decisions not yet defined, leave database initialization for its dedicated task and document that decision.

## Config package

Only create shared config if there is actual configuration to share during this bootstrap. Do not create an empty abstraction merely to satisfy the planned tree.

## Tooling

Pin or record the actual runtime/tool versions selected during implementation.

Prefer current stable releases compatible with one another.

Add:
- `.editorconfig` if useful;
- `.gitignore` updates as required;
- environment example only if a real environment variable is introduced;
- formatting/lint tooling only if configured and executable.

## Tests

At minimum:
- API health endpoint test;
- web app build/typecheck must pass.

Do not add meaningless tests solely to increase test count.

## Acceptance criteria

- `bun install` succeeds from repository root;
- workspace dependencies resolve correctly;
- API starts locally;
- `GET /health` succeeds;
- web app starts locally;
- web app production build succeeds;
- TypeScript checks pass;
- configured tests pass;
- no product feature was implemented;
- no MangaDex request exists yet;
- no database schema was invented;
- no secrets are committed.

## Validation

Run all relevant root validation scripts and record their results.

After successful completion:
1. update `docs/CURRENT_STATE.md`;
2. list files created/changed;
3. report commands executed;
4. report validation status;
5. report any known issues;
6. stop and do not begin TASK-002.
