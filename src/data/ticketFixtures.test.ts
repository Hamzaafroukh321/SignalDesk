import { describe, expect, it } from 'vitest'
import { ticketPriorities, ticketStatuses } from '../domain/ticket'
import {
  createTicketFixtures,
  ticketFixtureCount,
} from './ticketFixtures'

describe('ticket fixtures', () => {
  it('creates a deterministic, independent data set', () => {
    const first = createTicketFixtures()
    const second = createTicketFixtures()

    expect(first).toEqual(second)
    expect(first).not.toBe(second)

    first[0]?.tags.push({ id: 'temporary', label: 'Temporary' })
    expect(second[0]?.tags).not.toContainEqual({
      id: 'temporary',
      label: 'Temporary',
    })
  })

  it('keeps stable, unique identities across a realistically sized queue', () => {
    const tickets = createTicketFixtures()
    const ids = tickets.map((ticket) => ticket.id)

    expect(tickets).toHaveLength(ticketFixtureCount)
    expect(ticketFixtureCount).toBeGreaterThanOrEqual(24)
    expect(new Set(ids).size).toBe(ids.length)
    expect(ids.every((id) => /^SD-\d+$/.test(id))).toBe(true)
  })

  it('covers the domain states and edge cases required by the workspace', () => {
    const tickets = createTicketFixtures()

    expect(new Set(tickets.map((ticket) => ticket.status))).toEqual(
      new Set(ticketStatuses),
    )
    expect(new Set(tickets.map((ticket) => ticket.priority))).toEqual(
      new Set(ticketPriorities),
    )
    expect(tickets.some((ticket) => ticket.assignee === null)).toBe(true)
    expect(tickets.some((ticket) => ticket.tags.length > 1)).toBe(true)
    expect(tickets.some((ticket) => ticket.description.length > 200)).toBe(true)
    expect(
      tickets.every(
        (ticket) =>
          Date.parse(ticket.createdAt) <= Date.parse(ticket.updatedAt) &&
          ticket.version === 1 &&
          ticket.activities.length > 0,
      ),
    ).toBe(true)
  })
})
