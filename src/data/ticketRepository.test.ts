import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createTicketFixtures } from './ticketFixtures'
import {
  createTicketRepository,
  isAbortError,
  TicketRepositoryError,
  TicketVersionConflictError,
} from './ticketRepository'

async function finishTimers() {
  await vi.runAllTimersAsync()
}

describe('ticket repository', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('lists deterministic pages and returns detached ticket graphs', async () => {
    const repository = createTicketRepository({ defaultLatencyMs: 10 })
    const firstRequest = repository.listTickets({ pageSize: 5 })
    await finishTimers()
    const first = await firstRequest

    expect(first.tickets).toHaveLength(5)
    expect(first.totalCount).toBe(createTicketFixtures().length)
    expect(first.page).toBe(1)
    expect(first.totalPages).toBe(5)

    const originalTitle = first.tickets[0]?.title
    if (first.tickets[0]) first.tickets[0].title = 'Changed by a caller'
    const secondRequest = repository.listTickets({ pageSize: 5 })
    await finishTimers()
    const second = await secondRequest
    expect(second.tickets[0]?.title).toBe(originalTitle)
  })

  it('supports deterministic detail, update, bulk update, and note operations', async () => {
    const repository = createTicketRepository({ defaultLatencyMs: 0 })
    const fixtures = createTicketFixtures()
    const firstTicket = fixtures[0]
    const secondTicket = fixtures[1]
    expect(firstTicket).toBeDefined()
    expect(secondTicket).toBeDefined()
    if (!firstTicket || !secondTicket) return

    const detailRequest = repository.getTicket(firstTicket.id)
    await finishTimers()
    const detail = await detailRequest

    const updateRequest = repository.updateTicket({
      id: detail.id,
      expectedVersion: detail.version,
      changes: { title: 'Corrected annual invoice charge' },
    })
    await finishTimers()
    const updated = await updateRequest
    expect(updated.title).toBe('Corrected annual invoice charge')
    expect(updated.version).toBe(detail.version + 1)

    const bulkRequest = repository.bulkUpdateStatus({
      status: 'pending',
      targets: [
        { id: updated.id, expectedVersion: updated.version },
        { id: secondTicket.id, expectedVersion: secondTicket.version },
      ],
    })
    await finishTimers()
    const bulk = await bulkRequest
    expect(bulk.tickets.every((ticket) => ticket.status === 'pending')).toBe(true)

    const latestFirst = bulk.tickets.find((ticket) => ticket.id === updated.id)
    expect(latestFirst).toBeDefined()
    if (!latestFirst) return
    const noteRequest = repository.addTicketNote({
      id: latestFirst.id,
      expectedVersion: latestFirst.version,
      body: '  Customer confirmed the corrected amount.  ',
    })
    await finishTimers()
    const withNote = await noteRequest
    expect(withNote.activities.at(-1)?.message).toBe(
      'Customer confirmed the corrected amount.',
    )
  })

  it('aborts an in-flight request without settling its work', async () => {
    const repository = createTicketRepository({ defaultLatencyMs: 200 })
    const controller = new AbortController()
    const request = repository.listTickets({}, { signal: controller.signal })

    controller.abort()

    await expect(request).rejects.toSatisfy(isAbortError)
    await finishTimers()
  })

  it('injects failures in a repeatable order and allows a later retry', async () => {
    const repository = createTicketRepository({
      defaultLatencyMs: 20,
      plans: {
        listTickets: [
          { fault: { message: 'Planned queue outage.' } },
          { latencyMs: 5 },
        ],
      },
    })

    const failedRequest = repository.listTickets()
    const failure = expect(failedRequest).rejects.toMatchObject({
      code: 'UNAVAILABLE',
      message: 'Planned queue outage.',
    })
    await finishTimers()
    await failure

    const retryRequest = repository.listTickets()
    await finishTimers()
    await expect(retryRequest).resolves.toMatchObject({ totalCount: 24 })
  })

  it('rejects stale writes with the latest detached ticket', async () => {
    const repository = createTicketRepository({ defaultLatencyMs: 0 })
    const ticket = createTicketFixtures()[0]
    expect(ticket).toBeDefined()
    if (!ticket) return

    const firstWrite = repository.updateTicket({
      id: ticket.id,
      expectedVersion: ticket.version,
      changes: { priority: 'low' },
    })
    await finishTimers()
    const saved = await firstWrite

    const staleWrite = repository.updateTicket({
      id: ticket.id,
      expectedVersion: ticket.version,
      changes: { priority: 'normal' },
    })
    const conflict = expect(staleWrite).rejects.toBeInstanceOf(
      TicketVersionConflictError,
    )
    await finishTimers()
    await conflict

    const staleErrorRequest = repository.updateTicket({
      id: ticket.id,
      expectedVersion: ticket.version,
      changes: { priority: 'high' },
    })
    const capturedError = staleErrorRequest.catch((caught: unknown) => caught)
    await finishTimers()
    const error = await capturedError
    expect(error).toBeInstanceOf(TicketRepositoryError)
    expect((error as TicketVersionConflictError).currentTicket).toEqual(saved)
    ;(error as TicketVersionConflictError).currentTicket.title = 'Caller mutation'

    const detailRequest = repository.getTicket(ticket.id)
    await finishTimers()
    await expect(detailRequest).resolves.toMatchObject({ title: saved.title })
  })
})
