# SignalDesk

SignalDesk is a self-contained support-ticket triage application built with React and TypeScript. It is designed to make busy support queues easier to search, organize, and update while remaining dependable under asynchronous work and accessible from the keyboard.

## Product direction

The first release focuses on four connected workflows:

- finding tickets with search, filters, sorting, and pagination;
- selecting tickets and applying safe bulk status changes;
- reviewing and editing ticket details without losing list context;
- preserving the user's latest intent when asynchronous work completes out of order.

The application uses deterministic in-memory data rather than a backend. This keeps local development and automated tests reproducible and free from credentials or external services.

## Engineering principles

- Node.js 20 and npm at the repository root
- strict TypeScript and behavior-focused component tests
- semantic HTML, keyboard support, visible focus, and accessible status feedback
- stable ticket identity and explicit asynchronous lifecycle handling
- one cohesive product improvement per milestone

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

The static-analysis and component-test harnesses are introduced by the next setup milestones.
