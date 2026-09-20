# Agent instructions

This repository is **Finance**, a personal finance SPA backed by Firebase Authentication and Cloud Firestore. It sits next to `Portfolio-v2`; it is a separate git repo.

## Who implements

Application code is specified in `project-docs/`. Start with `project-docs/CODEX-BRIEF.md`.
The Vite application and its package scripts live in `finance-code/`; run frontend commands from that directory.

Do **not** use Jira, Linear, or MCP issue trackers. This project has no tickets. The docs are the spec.

## Stack locks

React, TypeScript, Vite, Recharts, `react-jss` (`createUseStyles`), Firebase Authentication, and Cloud Firestore. No inline styles and no Tailwind. GitHub Pages static host. Finance records must not be persisted in IndexedDB or localStorage.

PDF import is deferred. Custom tables are the v1 data path. Chart series: never sum inflow with outflow; combine same-kind series only when `canCombine` allows it.

## Code organization and style

- Keep exactly one React component per `.tsx` file. A component file exports that component only; put exported types, constants, calculations, and helpers in adjacent `.ts` files.
- If code is shared by sibling files, place it in a clearly named module beside their nearest common parent. Apply the same rule to shared types, constants, hooks, and utilities. Do not create distant catch-all utility files.
- Put network requests and remote API adapters in dedicated `api` modules. Components call those modules through hooks or query functions; components must not construct or send API requests directly.
- Never use JSX `style` props, `sx`, Tailwind, or ad-hoc CSS. Use `react-jss` classes backed by theme tokens. Values that are genuinely data-driven should become class variants, CSS custom properties set by a focused adapter, or library API props when the library owns rendering.
- From `finance-code/`, run `npm run lint`, `npm run format:check`, `npm test`, and `npm run build` before handing off code. Use `npm run format` to apply Prettier.
- ESLint and Prettier configuration are project policy. Do not disable rules inline to bypass these requirements; refactor the code instead.

## Node

Prefer `fnm`. Codex shells on Windows may not have `npm` on PATH.

## Git

Do not push, force-push, or change git config unless the user asks. Commit only when asked.
