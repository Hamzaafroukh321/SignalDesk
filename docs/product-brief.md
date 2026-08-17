# SignalDesk product brief

## Goal

Build a focused workspace for triaging customer-support tickets. SignalDesk should feel like a small, coherent product rather than a collection of disconnected components.

## Ticket model

Each ticket has a stable identifier, title, customer, status, priority, optional assignee, timestamps, tags, a description, a revision number, and an activity history.

## Primary journeys

1. Find tickets through search, filters, deterministic sorting, and pagination.
2. Select one or many tickets without losing their identity as results change.
3. Apply bulk status updates with understandable progress and outcomes.
4. Inspect and edit a ticket, validate changes, save optimistically, and recover from failures or conflicts.
5. Navigate efficiently with the keyboard, browser history, and saved list views.

## Quality bar

The interface must remain correct when asynchronous operations finish in an unexpected order. Controls must be semantic and labelled, focus movement must be predictable, and loading, empty, error, pending, and success states must be understandable without relying on color alone.

Tests must be deterministic and self-contained. No runtime service, private credential, analytics provider, or database is required.

## Non-goals

- authentication or authorization
- a production backend
- server-side rendering
- a global state library
- a third-party component system
- large animation or branding work
