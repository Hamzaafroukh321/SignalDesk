import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it } from 'vitest'
import { App } from './App'
import {
  createTicketRepository,
  type TicketListPage,
  type TicketRepository,
} from './data/ticketRepository'

const ticket = {
  id: 'SD-1048',
  title: 'Invoice shows duplicate annual charge',
} as const

interface Deferred<T> {
  promise: Promise<T>
  resolve: (value: T) => void
  reject: (reason: unknown) => void
}

function createDeferred<T>(): Deferred<T> {
  let resolve!: (value: T) => void
  let reject!: (reason: unknown) => void
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise
    reject = rejectPromise
  })
  return { promise, resolve, reject }
}

function ticketTrigger() {
  return screen.getByRole('button', {
    name: `Open ${ticket.id} details: ${ticket.title}`,
  })
}

function ticketSelection() {
  return screen.getByRole('checkbox', {
    name: `Select ${ticket.id}: ${ticket.title}`,
  })
}

describe('application accessibility hardening', () => {
  beforeEach(() => {
    window.history.replaceState(null, '', '/')
    window.localStorage.clear()
  })

  it('keeps landmarks, headings, table context, and status cues semantic', async () => {
    render(
      <App repository={createTicketRepository({ defaultLatencyMs: 0 })} />,
    )

    expect(screen.getByRole('banner')).toBeInTheDocument()
    expect(screen.getByRole('main')).toBeInTheDocument()
    expect(
      screen.getByRole('heading', {
        level: 1,
        name: 'Turn support signals into clear next steps.',
      }),
    ).toBeVisible()
    expect(
      screen.getByRole('region', { name: 'Ticket controls' }),
    ).toBeVisible()
    expect(
      screen.getByRole('region', { name: 'Ticket results' }),
    ).toBeVisible()

    const table = await screen.findByRole('table', {
      name: /Current ticket queue — showing 10 of 24/,
    })
    const tableScope = within(table)
    for (const name of [
      'Ticket',
      'Customer',
      'Status',
      'Priority',
      'Assignee',
      'Updated',
    ]) {
      expect(tableScope.getByRole('columnheader', { name })).toBeInTheDocument()
    }

    for (const row of tableScope.getAllByRole('row').slice(1)) {
      expect(row.querySelector('[class*="status-"]')).toHaveTextContent(/\S/)
      expect(row.querySelector('[class*="priority-"]')).toHaveTextContent(/\S/)
    }

    const ids = [...document.querySelectorAll<HTMLElement>('[id]')].map(
      (element) => element.id,
    )
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('returns focus to search when its disappearing clear action runs', async () => {
    const user = userEvent.setup()
    render(
      <App repository={createTicketRepository({ defaultLatencyMs: 0 })} />,
    )
    await screen.findByRole('table')

    const search = screen.getByRole('searchbox', { name: 'Search tickets' })
    await user.type(search, 'Atlas')
    await user.click(screen.getByRole('button', { name: 'Clear search' }))

    await waitFor(() => expect(search).toHaveFocus())
  })

  it('keeps focus in ticket controls after clearing every active filter', async () => {
    const user = userEvent.setup()
    render(
      <App repository={createTicketRepository({ defaultLatencyMs: 0 })} />,
    )
    await screen.findByRole('table')

    const controls = screen.getByRole('region', { name: 'Ticket controls' })
    const firstStatusFilter = within(controls).getByRole('checkbox', {
      name: 'New',
    })
    await user.click(firstStatusFilter)
    await user.click(
      within(controls).getByRole('button', { name: 'Clear all filters' }),
    )

    await waitFor(() => expect(firstStatusFilter).toHaveFocus())
  })

  it('keeps focus in ticket results after clearing selection', async () => {
    const user = userEvent.setup()
    render(
      <App repository={createTicketRepository({ defaultLatencyMs: 0 })} />,
    )
    await screen.findByRole('table')

    const results = screen.getByRole('region', { name: 'Ticket results' })
    await user.click(ticketSelection())
    await user.click(
      within(results).getByRole('button', { name: 'Clear selection' }),
    )

    await waitFor(() =>
      expect(
        within(results).getByRole('heading', { name: 'Ticket results' }),
      ).toHaveFocus(),
    )
  })

  it('keeps retry focus in results during pending work and another failure', async () => {
    const baseRepository = createTicketRepository({ defaultLatencyMs: 0 })
    const retryRequest = createDeferred<TicketListPage>()
    let listCallCount = 0
    const repository: TicketRepository = {
      ...baseRepository,
      listTickets() {
        listCallCount += 1
        return listCallCount === 1
          ? Promise.reject(new Error('Initial list failure.'))
          : retryRequest.promise
      },
    }
    const user = userEvent.setup()
    render(<App repository={repository} />)

    const retry = await screen.findByRole('button', {
      name: 'Retry loading tickets',
    })
    const results = screen.getByRole('region', { name: 'Ticket results' })
    const resultsHeading = within(results).getByRole('heading', {
      name: 'Ticket results',
    })
    await user.click(retry)
    expect.soft(resultsHeading).toHaveFocus()

    await act(async () => {
      retryRequest.reject(new Error('Retry list failure.'))
      await Promise.resolve()
    })
    await screen.findByRole('button', { name: 'Retry loading tickets' })
    expect(resultsHeading).toHaveFocus()
  })

  it('announces only the latest search result and uses grammatical singular copy', async () => {
    const baseRepository = createTicketRepository({ defaultLatencyMs: 0 })
    const [initialPage, olderPage, latestPage] = await Promise.all([
      baseRepository.listTickets(),
      baseRepository.listTickets({ search: 'Billing' }),
      baseRepository.listTickets({ search: 'Atlas & Pine' }),
    ])
    const olderRequest = createDeferred<TicketListPage>()
    const latestRequest = createDeferred<TicketListPage>()
    const queries: string[] = []
    const repository: TicketRepository = {
      ...baseRepository,
      listTickets(query = {}) {
        const search = query.search ?? ''
        queries.push(search)
        if (!search) return Promise.resolve(initialPage)
        if (search === 'Billing') return olderRequest.promise
        if (search === 'Atlas & Pine') return latestRequest.promise
        return baseRepository.listTickets(query)
      },
    }
    render(<App repository={repository} />)
    await screen.findByRole('table')

    const search = screen.getByRole('searchbox', { name: 'Search tickets' })
    fireEvent.change(search, { target: { value: 'Billing' } })
    await waitFor(() => expect(queries.at(-1)).toBe('Billing'))
    fireEvent.change(search, { target: { value: 'Atlas & Pine' } })
    await waitFor(() => expect(queries.at(-1)).toBe('Atlas & Pine'))

    await act(async () => {
      latestRequest.resolve(latestPage)
      await latestRequest.promise
    })
    await screen.findByRole('table', { name: /showing 1 of 1/ })

    await act(async () => {
      olderRequest.resolve(olderPage)
      await olderRequest.promise
    })

    expect(screen.getByText('1 ticket is ready for review.')).toBeVisible()
    expect(
      screen.getByTestId('polite-operation-announcements'),
    ).toHaveTextContent('Ticket queue ready. 1 total; page 1 of 1.')
  })

  it('keeps focus inside details while a retry is pending and after success', async () => {
    const baseRepository = createTicketRepository({ defaultLatencyMs: 0 })
    const authoritativeTicket = await baseRepository.getTicket(ticket.id)
    const retryRequest = createDeferred<typeof authoritativeTicket>()
    let detailCallCount = 0
    const repository: TicketRepository = {
      ...baseRepository,
      getTicket() {
        detailCallCount += 1
        return detailCallCount === 1
          ? Promise.reject(new Error('Initial detail failure.'))
          : retryRequest.promise
      },
    }
    const user = userEvent.setup()
    render(<App repository={repository} />)
    await screen.findByRole('table')

    await user.click(ticketTrigger())
    const dialog = await screen.findByRole('dialog')
    await user.click(
      await within(dialog).findByRole('button', {
        name: 'Retry ticket details',
      }),
    )

    const close = within(dialog).getByRole('button', { name: 'Close details' })
    expect(within(dialog).getByRole('status')).toHaveTextContent(
      `Loading ${ticket.id} details…`,
    )
    expect.soft(close).toHaveFocus()
    await user.keyboard('{Shift>}{Tab}{/Shift}')
    expect.soft(close).toHaveFocus()

    await act(async () => {
      retryRequest.resolve(authoritativeTicket)
      await retryRequest.promise
    })
    await screen.findByRole('dialog', { name: ticket.title })
    expect(close).toHaveFocus()
  })

  it('describes the consequence of the unsaved-changes alertdialog', async () => {
    const user = userEvent.setup()
    render(
      <App repository={createTicketRepository({ defaultLatencyMs: 0 })} />,
    )
    await screen.findByRole('table')

    await user.click(ticketTrigger())
    const dialog = await screen.findByRole('dialog', { name: ticket.title })
    const dialogScope = within(dialog)
    await user.click(dialogScope.getByRole('button', { name: 'Edit ticket' }))
    await user.type(
      dialogScope.getByRole('textbox', { name: 'Title' }),
      ' with an unsaved change',
    )
    await user.click(dialogScope.getByRole('button', { name: 'Close details' }))

    let confirmation = screen.getByRole('alertdialog', {
      name: 'Discard unsaved changes?',
    })
    expect(confirmation).toHaveAccessibleDescription(
      'Closing ticket details will discard the edits in this form.',
    )

    await user.click(
      within(confirmation).getByRole('button', { name: 'Continue editing' }),
    )
    await user.click(
      screen.getByRole('button', {
        name: 'Open SD-1062 details: Export finished with missing rows',
      }),
    )
    confirmation = screen.getByRole('alertdialog', {
      name: 'Discard unsaved changes?',
    })
    expect(confirmation).toHaveAccessibleDescription(
      'Opening another ticket will discard the edits in this form.',
    )
  })

  it('groups bulk controls and exposes their disabled pending state', async () => {
    const baseRepository = createTicketRepository({ defaultLatencyMs: 0 })
    const repository: TicketRepository = {
      ...baseRepository,
      bulkUpdateStatus: () => new Promise<never>(() => {}),
    }
    const user = userEvent.setup()
    render(<App repository={repository} />)
    await screen.findByRole('table')

    const bulkActions = screen.getByRole('group', {
      name: 'Bulk status update',
    })

    await user.click(ticketSelection())
    const bulkScope = within(bulkActions)
    await user.click(bulkScope.getByRole('button', { name: 'Apply status' }))

    expect(
      bulkScope.getByRole('button', { name: 'Applying status…' }),
    ).toBeDisabled()
    expect(
      bulkScope.getByRole('combobox', {
        name: 'New status for selected tickets',
      }),
    ).toBeDisabled()
    expect(ticketSelection()).toBeDisabled()
    expect(
      screen.getByRole('button', { name: 'Clear selection' }),
    ).toBeDisabled()
    expect(bulkScope.getByRole('status')).toHaveTextContent(
      'Updating 1 ticket…',
    )
  })
})
