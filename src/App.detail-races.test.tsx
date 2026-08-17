import { act, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it } from 'vitest'
import { App } from './App'
import {
  createTicketRepository,
  type TicketRepository,
} from './data/ticketRepository'

interface DetailRequest {
  id: string
  signal: AbortSignal | undefined
}

const firstTicket = {
  id: 'SD-1048',
  title: 'Invoice shows duplicate annual charge',
}

const secondTicket = {
  id: 'SD-1062',
  title: 'Export finished with missing rows',
}

function detailTrigger(ticket: typeof firstTicket) {
  return screen.getByRole('button', {
    name: `Open ${ticket.id} details: ${ticket.title}`,
  })
}

function ignoreDetailCancellation(
  baseRepository: TicketRepository,
  requests: DetailRequest[],
): TicketRepository {
  return {
    ...baseRepository,
    getTicket(id, options = {}) {
      requests.push({ id, signal: options.signal })
      return baseRepository.getTicket(id)
    },
  }
}

describe('ticket detail request ownership', () => {
  beforeEach(() => {
    window.history.replaceState(null, '', '/')
    window.localStorage.clear()
  })

  it('keeps B visible when A fails after B succeeds', async () => {
    const user = userEvent.setup()
    const requests: DetailRequest[] = []
    const baseRepository = createTicketRepository({
      defaultLatencyMs: 0,
      plans: {
        getTicket: [
          {
            latencyMs: 120,
            fault: { message: 'The obsolete A request failed.' },
          },
          { latencyMs: 5 },
        ],
      },
    })
    const repository = ignoreDetailCancellation(baseRepository, requests)
    render(<App repository={repository} />)
    await screen.findByRole('table')

    await user.click(detailTrigger(firstTicket))
    await waitFor(() => expect(requests).toHaveLength(1))
    await user.click(detailTrigger(secondTicket))
    await waitFor(() => expect(requests).toHaveLength(2))
    expect(requests[0]).toMatchObject({ id: firstTicket.id })
    expect(requests[0]?.signal?.aborted).toBe(true)

    const dialog = await screen.findByRole('dialog', {
      name: secondTicket.title,
    })
    expect(
      within(dialog).getByRole('button', { name: 'Close details' }),
    ).toHaveFocus()
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 140))
    })

    expect(
      screen.getByRole('dialog', { name: secondTicket.title }),
    ).toBeVisible()
    expect(
      within(dialog).queryByText('Ticket details are unavailable'),
    ).not.toBeInTheDocument()
    expect(within(dialog).queryByText(firstTicket.title)).not.toBeInTheDocument()
  })

  it('keeps B error state when A succeeds after B fails', async () => {
    const user = userEvent.setup()
    const requests: DetailRequest[] = []
    const baseRepository = createTicketRepository({
      defaultLatencyMs: 0,
      plans: {
        getTicket: [
          { latencyMs: 120 },
          {
            latencyMs: 5,
            fault: { message: 'The active B request failed.' },
          },
        ],
      },
    })
    const repository = ignoreDetailCancellation(baseRepository, requests)
    render(<App repository={repository} />)
    await screen.findByRole('table')

    await user.click(detailTrigger(firstTicket))
    await waitFor(() => expect(requests).toHaveLength(1))
    await user.click(detailTrigger(secondTicket))
    await waitFor(() => expect(requests).toHaveLength(2))
    expect(requests[0]?.signal?.aborted).toBe(true)

    const activeError = await screen.findByText(
      `SignalDesk could not load ${secondTicket.id}. The queue is unchanged.`,
    )
    const dialog = activeError.closest('dialog')
    if (!dialog) throw new Error('Expected the active detail dialog.')
    expect(within(dialog).getByText('Ticket details are unavailable')).toBeVisible()
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 140))
    })

    expect(activeError).toBeVisible()
    expect(within(dialog).queryByText(firstTicket.title)).not.toBeInTheDocument()
    expect(
      within(dialog).getByRole('button', { name: 'Retry ticket details' }),
    ).toBeVisible()
  })

  it('aborts pending detail work on close and never reopens the dialog', async () => {
    const user = userEvent.setup()
    const requests: DetailRequest[] = []
    const baseRepository = createTicketRepository({
      defaultLatencyMs: 0,
      plans: {
        getTicket: [{ latencyMs: 120 }],
      },
    })
    const repository = ignoreDetailCancellation(baseRepository, requests)
    render(<App repository={repository} />)
    await screen.findByRole('table')
    const trigger = detailTrigger(firstTicket)

    await user.click(trigger)
    expect(
      await screen.findByText(`Loading ${firstTicket.id} details…`),
    ).toBeVisible()
    await waitFor(() => expect(requests).toHaveLength(1))
    await user.click(screen.getByRole('button', { name: 'Close details' }))

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect(requests[0]?.signal?.aborted).toBe(true)
    expect(trigger).toHaveFocus()
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 140))
    })
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(trigger).toHaveFocus()
  })

  it('opens an untouched ticket switch read-only with B focus semantics', async () => {
    const user = userEvent.setup()
    render(
      <App repository={createTicketRepository({ defaultLatencyMs: 0 })} />,
    )
    await screen.findByRole('table')

    await user.click(detailTrigger(firstTicket))
    let dialog = await screen.findByRole('dialog', {
      name: firstTicket.title,
    })
    await user.click(within(dialog).getByRole('button', { name: 'Edit ticket' }))
    expect(within(dialog).getByRole('textbox', { name: 'Title' })).toBeVisible()

    const secondTrigger = detailTrigger(secondTicket)
    await user.click(secondTrigger)
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument()
    dialog = await screen.findByRole('dialog', { name: secondTicket.title })

    expect(
      within(dialog).queryByRole('textbox', { name: 'Title' }),
    ).not.toBeInTheDocument()
    const close = within(dialog).getByRole('button', { name: 'Close details' })
    expect(close).toHaveFocus()
    await user.click(close)
    expect(secondTrigger).toHaveFocus()
  })
})
