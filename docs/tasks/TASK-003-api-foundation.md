# TASK-003 — API foundation

## Objective

Complete the minimum HTTP foundation around the existing Hono application.

## Scope

- validate API environment values with Zod;
- provide consistent JSON errors for unhandled routes and unexpected failures;
- emit baseline request logs;
- add focused API tests and update project state.

## Constraints

- do not add provider calls, database access, authentication or product endpoints;
- do not expose provider-specific errors;
- keep `GET /health` deterministic.

## Acceptance criteria

- invalid `PORT` values prevent the API from starting;
- `GET /health` still returns the documented response;
- unknown routes return a consistent JSON 404 error;
- each completed request produces a structured log entry;
- all root quality, typecheck, test and build commands pass.
