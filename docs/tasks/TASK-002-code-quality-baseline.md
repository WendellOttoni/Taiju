# TASK-002 — Code quality baseline

## Objective

Configure consistent formatting, linting and import organization for the Bun workspace.

## Scope

- add one repository-wide quality tool;
- expose root scripts for formatting and linting;
- keep the existing TypeScript and Bun test setup working;
- document the completed state.

## Constraints

- do not add product behavior, external providers, persistence or API features;
- do not introduce a second formatting/linting tool;
- do not reformat generated build artifacts.

## Acceptance criteria

- `bun run format` formats supported source files;
- `bun run lint` checks formatting, lint rules and import organization;
- `bun run typecheck`, `bun run test` and `bun run build` pass;
- the workspace remains free of provider integrations.
