# Repository Guidelines

## Project Structure & Module Organization
- Monorepo managed by `pnpm` (see `pnpm-workspace.yaml`).
- Packages: `packages/core`, `packages/shared`, `packages/adapters/*` (e.g., `openrouter`, `claude-code`, `synthetic`).
- Source lives under `packages/**/src`; build output goes to `packages/**/dist`.
- Tests: `packages/**/src/**/*.{test,spec}.ts`. Root repo may include Jest scenarios under `src/test`.

## Build, Test, and Development Commands
- Install: `pnpm install` — install all workspace dependencies.
- Dev (watch): `pnpm -r dev` — TypeScript watch across packages.
- Build: `pnpm -r build` — compile all packages to `dist/`.
- Test: `pnpm -r test` — run Vitest/Jest where configured.
- Lint/Types: `pnpm -r lint` and `pnpm -r type-check`.

## Coding Style & Naming Conventions
- Language: TypeScript (ESM, Node 20+), strict mode; never use `any`.
- Formatting: Prettier (2 spaces, single quotes, semicolons, ~80 chars).
- Linting: ESLint + TS rules (no-unused-vars, prefer-const, no-var, no console in prod).
- Naming: files `kebab-case.ts`; types/classes `PascalCase`; vars/functions `camelCase`; constants `UPPER_SNAKE_CASE`.

## Testing Guidelines
- Frameworks: Vitest in packages; Jest used in root harness when needed.
- Coverage targets: 80% global min; 90% for memory/coordination paths.
- Test files: `*.test.ts` or `*.spec.ts` alongside code in `src/`.
- Focused runs: `vitest -t "pattern"` in a package; or `pnpm -r test` for all.

## Commit & Pull Request Guidelines
- Commits: Conventional Commits (e.g., `feat(core): implement SQLite memory store`).
- PRs: rebase on `main`, pass `pnpm -r lint && pnpm -r type-check && pnpm -r test`, include clear description, link issues, update docs for API changes.

## Agent Workflow (Adapted from CLAUDE.md)
- Roles: Claude Code (architecture, QA) and Codex (implementation).
- Protocols: when a protocol is requested (e.g., task completion, context compaction), first read `sessions/protocols/*` then execute.
- Task state: maintain `.claude/state/current_task.json` using the format in `CLAUDE.md`.
- Delegation: prefer MCP adapters (Synthetic/OpenRouter); use structured parameters and minimal prompts.

