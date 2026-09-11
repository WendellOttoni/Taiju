# Current State

Last completed setup step: TASK-026 — Paged reader.

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
- Chapter API endpoint with validated language and pagination parameters.
- Chapter list rendered on manga detail pages.
- MangaDex@Home chapter-page resolver isolated in the provider package.
- Reader route and normalized chapter-page endpoint.
- Vertical reader with lazy-loaded pages, per-page failure feedback, chapter navigation and local progress capture.
- Optional page-by-page reader with keyboard/button navigation and adjacent-page preloading.

## Not implemented yet

- PostgreSQL/Drizzle setup;
- authentication;
- paged reader and reader preferences;
- user library/progress;
- anime features.

## Current phase

MangaDex integration / vertical reader complete.

## Next task

`TASK-027 — Reader preferences`

See `docs/DEVELOPMENT_PLAN.md`.

## Known issues

The database package intentionally has no Drizzle configuration or schema. Those choices require a dedicated persistence task.
