import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it } from 'vitest'
import { App } from './App'
import {
  createTicketRepository,
  type TicketRepository,
} from './data/ticketRepository'
import type { Ticket, TicketId } from './domain/ticket'

function instrumentCustomerRead(
  ticket: Ticket,
  reads: Map<TicketId, number>,
): Ticket {
  // TicketRow reads customer once per render, so this getter is a test-only
  // counter that does not require instrumentation in production code.
  const customer = ticket.customer
  const instrumented = { ...ticket }

  Object.defineProperty(instrumented, 'customer', {
    configurable: true,
    enumerable: true,
    get() {
      reads.set(ticket.id, (reads.get(ticket.id) ?? 0) + 1)
      return customer
    },
  })

  return instrumented
}

function createInstrumentedRepository(reads: Map<TicketId, number>) {
  const repository = createTicketRepository({ defaultLatencyMs: 0 })

  return {
    ...repository,
    async listTickets(query, options) {
      const page = await repository.listTickets(query, options)
      return {
        ...page,
        tickets: page.tickets.map((ticket) =>
          instrumentCustomerRead(ticket, reads),
        ),
      }
    },
  } satisfies TicketRepository
}

describe('ticket row rendering', () => {
  beforeEach(() => {
    window.history.replaceState(null, '', '/')
    window.localStorage.clear()
  })

  it('skips unrelated row renders and updates only the selected row', async () => {
    const user = userEvent.setup()
    const customerReads = new Map<TicketId, number>()
    render(<App repository={createInstrumentedRepository(customerReads)} />)

    await screen.findByRole('table')
    expect(customerReads.size).toBe(10)
    customerReads.clear()

    const bulkStatus = screen.getByRole('combobox', {
      name: 'New status for selected tickets',
    })
    await user.selectOptions(bulkStatus, 'open')

    expect(bulkStatus).toHaveValue('open')
    expect(customerReads.size).toBe(0)

    const selectedId: TicketId = 'SD-1048'
    const ticketCheckbox = screen.getByRole('checkbox', {
      name: 'Select SD-1048: Invoice shows duplicate annual charge',
    })
    await user.click(ticketCheckbox)

    expect(ticketCheckbox).toBeChecked()
    expect(screen.getByText('1 ticket selected')).toBeVisible()
    expect(customerReads).toEqual(new Map([[selectedId, 1]]))
  })
})
