# SignalDesk

SignalDesk is a self-contained support-ticket triage application built with React and TypeScript. It is designed to make busy support queues easier to search, organize, and update while remaining dependable under asynchronous work and accessible from the keyboard.

## Product direction

The first release focuses on four connected workflows:

- finding tickets with search, filters, sorting, and pagination;
- selecting tickets and applying safe bulk status changes;
- reviewing and editing ticket details without losing list context;
- preserving the user's latest intent when asynchronous work completes out of order.

The application uses deterministic in-memory data rather than a backend. This keeps local development and automated tests reproducible and free from credentials or external services.

## Architecture

- `src/App.tsx` renders the application shell and the centralized announcement provider.
- `TicketWorkspace` owns URL-backed list state, normalized ticket entities, selection, saved views, detail state, and asynchronous request ownership. List and detail surfaces reconcile through the same ticket identities.
- `TicketTable` and its memoized `TicketRow` render one semantic result table. CSS reflows that same tree into small-screen cards without duplicating controls or state.
- `TicketDetailsDialog` contains detail loading, editing, notes, unsaved-change confirmation, and focus trapping. `TicketWorkspace` records the initiating control and restores focus when details close.
- `src/domain/ticket.ts` defines the ticket model. `src/data/ticketRepository.ts` is the asynchronous boundary used by the UI and tests.

## Local development

SignalDesk requires Node.js 20 and npm 10 or newer. After selecting the runtime listed in `.nvmrc`, install the frozen dependency tree with `npm ci`.

| Command | Purpose |
| --- | --- |
| `npm run dev` | Start the local Vite development server. |
| `npm run build` | Type-check and create a production build. |
| `npm run lint` | Run the zero-warning source lint gate. |
| `npm run typecheck` | Run TypeScript without emitting files. |
| `npm test` | Run the component test suite once. |
| `npm run check` | Run lint, type-checking, and tests together. |

The app does not require environment variables, credentials, or a running backend. `npm run dev` prints the local URL used by Vite.

## Testing and release checks

Tests use Vitest, jsdom, React Testing Library, and `user-event`. Repository, component, race, accessibility, responsive-structure, rendering, and multi-step integration coverage all run without a real network. Planned latency and Promise gates make asynchronous ordering deterministic.

Every change should pass `npm run check` and `npm run build`. For a clean release verification, run `npm ci` first and confirm that it does not modify `package-lock.json`. GitHub Actions repeats the frozen install, checks, and production build on pushes to `main` and on pull requests.

## Accessibility conventions

- Use named landmarks, a skip link, ordered headings, native form controls, and the single semantic results table.
- Keep status and priority labels as text; color is supplemental, never the only cue.
- Preserve visible focus, contain focus inside dialogs, and restore it to the exact initiating control when possible.
- Associate validation messages with their fields and move focus to actionable errors.
- Route operation outcomes through the centralized polite or assertive live regions.
- Keep pending and disabled controls explicitly labelled, including saving, note, list, detail, and bulk states.
- `/` focuses ticket search. `Escape` closes details or returns from unsaved-change confirmation to editing.

## In-memory repository

`createTicketRepository` starts from deterministic ticket fixtures and implements list, detail, edit, bulk-status, and note operations. Commands and nested return values are cloned so callers cannot mutate repository state by reference. Every mutation uses an expected ticket version; stale writes reject with `TicketVersionConflictError`, which carries the current authoritative ticket.

The repository supports abort signals, configurable latency, and ordered per-operation failure plans. Those controls are used to prove loading, rollback, retry, and stale-response behavior without randomness. Repository changes live only for the current application instance and reset on reload. Saved views are separate user preferences stored in local storage.

## Authoring tasks

A task should describe one observable product or engineering outcome. Reproduce a defect before recording it; do not invent issues to fill a task list. State the behavior to preserve, the verification command or journey, and any explicit scope boundary.

Keep patches source-only: source code, tests, configuration, and documentation belong in Git; generated builds, coverage, dependency trees, logs, and browser artifacts do not. Prefer the smallest coherent change that proves its outcome while preserving established behavior.
