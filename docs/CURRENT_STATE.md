# Current State

Last completed setup step: TASK-011 — First extension runtime adapter.

## Implemented

- project vision defined;
- stack selected;
- monorepo boundaries defined;
- agent-development rules documented;
- initial architecture documented;
- roadmap created;
- Bun workspace bootstrap;
- Hono API application with a tested `GET /health` endpoint;
- React/Vite web starter branded as Taiju;
- Tailwind CSS and shadcn/ui project configuration for the web app;
- shared contracts, providers and database package boundaries;
- shared TypeScript compiler baseline.
- Biome formatting, linting and import-organization baseline.
- API environment validation, structured request logging and consistent JSON errors.
- Isolated MangaDex HTTP client with timeout, cancellation and rate-limit error translation.
- Shared Zod contracts for normalized manga search requests, summaries and paginated responses.
- Manga search API endpoint backed by the isolated MangaDex provider adapter.
- Responsive search UI consuming only the Taiju API contract.
- Normalized MangaDex details endpoint for title metadata, contributors, tags, languages and cover.
- Public manga details page linked from search results and backed by Taiju API contracts.
- Normalized MangaDex chapter feed with language filters, pagination and scanlation groups.
- Chapter feed tolerates MangaDex chapters without `publishAt`, falling back to `createdAt`, and normalizes timezone-offset timestamps to UTC.
- Chapter API endpoint with validated language and pagination parameters.
- Chapter list rendered on manga detail pages.
- MangaDex@Home chapter-page resolver isolated in the provider package.
- Unavailable MangaDex@Home chapters return a clear `content_unavailable` response, with structured API error logs.
- Reader route and normalized chapter-page endpoint.
- Vertical reader with lazy-loaded pages, per-page failure feedback, chapter navigation and local progress capture.
- Optional page-by-page reader with keyboard/button navigation and adjacent-page preloading.
- Reader settings persisted locally for mode, reading direction, image fit and UI visibility.
- PostgreSQL/Drizzle package foundation with validated connection URLs, bounded client pool defaults and migration scripts.
- Taiju-owned `users` and `profiles` tables with a generated migration and normalized unique email constraint.
- E-mail/password authentication with Argon2id hashes, signed seven-day JWTs and authenticated-user endpoint.
- Authenticated library endpoints and persisted MangaDex favorites with user-scoped uniqueness.
- User-scoped reading history records for manga, chapter, page and last update, with an indexed upsert model.
- Authenticated progress-sync and reading-history endpoints for resuming on another session or device.
- Source-neutral contracts for reading capabilities, language, provenance and external source identity; the initial rollout prioritizes `pt-BR` and `en`.
- Isolated Project Nox `index.pb` catalog client with timeout, cancellation, size bounds and deterministic fetch injection.
- Project Nox protobuf/gzip index decoder with normalized extension/source catalog models and deterministic fixtures.
- In-memory source registry with stable IDs, language normalization/prioritization, provenance and enablement state.
- Runtime investigation completed: Project Nox extensions are JVM/Android artifacts; direct Bun execution was rejected and an isolated JVM worker was selected for the proof of concept.
- JVM runtime IPC boundary implemented with explicit operations, response validation, timeout and process lifecycle isolation.
- Cliente GraphQL Suwayomi com timeout, cancelamento e tradução de falhas.
- Adaptador de leitura Suwayomi para busca, detalhes, capítulos e páginas, convertido para contratos Taiju com referências explícitas de fonte.
- `GET /api/sources` lista somente fontes efetivamente carregadas no sidecar Suwayomi; aceita `language` repetido como filtro e não expõe DTOs do host.

## Not implemented yet

- Busca, detalhes, capítulos e leitor ligados às fontes selecionadas; a interface ainda usa o fluxo legado MangaDex.
- Orquestração de busca multi-source e UI de seleção de fontes.
- Scanner catalog-wide: compatibilidade deve ser confirmada por fonte instalada no sidecar, não inferida apenas do catálogo.
- Validação persistente ao vivo de busca, detalhes, capítulos e páginas em uma fonte de fixture.

## Current phase

Source-engine migration started; existing MangaDex flow remains the legacy adapter until subsequent source tasks.

## Next task

`TASK-014 — Single-source search API`

See `docs/DEVELOPMENT_PLAN.md`.

## Known issues

Authentication is enabled only when both `DATABASE_URL` and `AUTH_JWT_SECRET` are configured; migrations require a running PostgreSQL instance and were not applied in this workspace.

Anime work is explicitly deferred and outside the current scope.

Para teste na mesma rede, o frontend possui o comando `bun run dev:web:lan`; o proxy Vite mantém as requisições `/api` no backend local.

Para habilitar fontes dinâmicas localmente, inicie o sidecar Suwayomi e defina
`SUWAYOMI_URL` (por exemplo, `http://127.0.0.1:4567`) antes de iniciar a API.
