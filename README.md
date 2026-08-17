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

Implementation and development commands will be documented as the application scaffold is established.
