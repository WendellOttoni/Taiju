# Taiju Agent Development Rules

Taiju is developed incrementally through small, explicit technical tasks.

These rules apply to AI coding agents working in this repository.

## Core rules

1. Execute only the requested task.
2. Read `README.md`, `docs/ARCHITECTURE.md` and `docs/CURRENT_STATE.md` before changing code.
3. Do not implement future features unless the task explicitly requires them.
4. Do not refactor unrelated code.
5. Prefer the simplest design that satisfies the current requirement.
6. Do not introduce abstractions solely for hypothetical future use.
7. Preserve provider boundaries: external API DTOs must not become Taiju public contracts.
8. Prefer explicit dependencies over hidden global state.
9. Avoid duplicated domain contracts across apps when a shared contract is appropriate.
10. Validate external input and provider responses at boundaries.
11. Never commit secrets, access tokens, API keys or environment-specific credentials.
12. Keep network, persistence and UI concerns separated.
13. If a problem is discovered outside task scope, document it instead of silently expanding the task.
14. Add or update tests when behavior changes.
15. Run the relevant validation commands before considering a task complete.
16. Never continue automatically to the next task.

## Stack constraints

Unless a task explicitly changes the architecture, use:

- Bun as runtime/package manager for the TypeScript workspace;
- Hono for the API;
- React + Vite for the web client;
- TypeScript across application code;
- Zod for runtime boundary validation;
- PostgreSQL for durable application data;
- Drizzle ORM for schema/migrations/data access;
- Tailwind CSS + shadcn/ui for the web UI.

## Monorepo boundaries

### `apps/web`
Browser-facing React application. It should consume Taiju API contracts rather than external provider DTOs.

### `apps/api`
HTTP transport layer and application composition. Route handlers should stay small and delegate provider/data behavior.

### `packages/contracts`
Shared Taiju-owned schemas/types intended to cross application boundaries.

### `packages/providers`
Clients, DTOs, mappers and errors for external services such as MangaDex, AniList, Jikan and trace.moe.

### `packages/database`
Drizzle schema, migrations and database-specific access.

### `packages/config`
Shared project configuration only when actual duplication justifies it.

## External provider rules

- Treat every provider as unreliable input.
- Use explicit timeouts and cancellation where supported.
- Translate provider-specific failures before exposing them from Taiju APIs.
- Respect rate limits.
- Do not expose raw provider responses directly to the frontend.
- Do not assume title/chapter availability is permanent.
- Keep provider IDs identifiable as provider IDs rather than pretending they are universal Taiju IDs.

## Completion report

Every completed coding task should end with a concise report containing:

- files created;
- files changed;
- behavior implemented;
- commands/tests executed;
- validation result;
- known issues or follow-ups;
- confirmation that no out-of-scope feature was implemented.

Update `docs/CURRENT_STATE.md` when a task changes the implemented project state.
