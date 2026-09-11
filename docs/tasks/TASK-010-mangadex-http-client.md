# TASK-010 — MangaDex HTTP client

## Objective

Create the low-level MangaDex HTTP client inside `packages/providers`.

## Scope

- configure the MangaDex API origin;
- make fetch injectable for deterministic tests;
- support caller cancellation and a bounded request timeout;
- translate HTTP and rate-limit failures into provider-specific errors;
- expose rate-limit response headers without leaking any DTO to Taiju applications.

## Constraints

- do not implement a manga search endpoint or manga DTO;
- do not call MangaDex from the API or browser;
- do not retry requests automatically;
- prevent this client from targeting an arbitrary external origin.

## Acceptance criteria

- successful requests accept JSON from `https://api.mangadex.org` by default;
- a 429 response becomes a `MangaDexRateLimitError` with rate-limit metadata;
- other non-success responses become a provider-specific HTTP error;
- timeouts reject with a provider-specific timeout error;
- package tests, root lint, typecheck, tests and build pass.
