# TASK-011 — Manga search contract

## Objective

Define Taiju-owned runtime contracts for normalized manga search data.

## Scope

- add Zod schemas and inferred TypeScript types to `packages/contracts`;
- model manga summaries, bounded search parameters and paginated responses;
- preserve MangaDex identity explicitly in the initial provider reference;
- add deterministic contract tests.

## Constraints

- do not use MangaDex response DTO shapes;
- do not implement API routes, provider endpoint calls or web UI;
- do not define manga details, chapters or reader contracts yet.

## Acceptance criteria

- contracts validate normalized manga summaries and search responses;
- provider and provider ID remain explicit;
- query pagination has safe defaults and bounds;
- no provider DTO is exported from `packages/contracts`;
- root formatting, lint, typecheck, tests and build pass.
