import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { App } from './App'
import { createTicketRepository } from './data/ticketRepository'

describe('SignalDesk application shell', () => {
  beforeEach(() => {
    window.history.replaceState(null, '', '/')
  })

  it('provides the landmarks and context for the ticket workspace', () => {
    render(<App />)

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
    ).toBeInTheDocument()
    expect(
      screen.getByRole('region', { name: 'Ticket results' }),
    ).toBeInTheDocument()
    expect(screen.getByRole('status')).toHaveTextContent(
      'Loading the ticket queue…',
    )
  })

  it('moves keyboard focus to the main workspace through the skip link', async () => {
    const user = userEvent.setup()
    render(<App />)

    const skipLink = screen.getByRole('link', {
      name: 'Skip to ticket workspace',
    })
    await user.click(skipLink)

    expect(screen.getByRole('main')).toHaveFocus()
  })

  it('renders repository tickets in an accessible results table', async () => {
    render(
      <App repository={createTicketRepository({ defaultLatencyMs: 0 })} />,
    )

    const table = await screen.findByRole('table', {
      name: /Current ticket queue — showing 10 of 24/,
    })
    const tableScope = within(table)

    expect(tableScope.getByRole('columnheader', { name: 'Ticket' })).toBeVisible()
    expect(
      tableScope.getByRole('columnheader', { name: 'Customer' }),
    ).toBeVisible()
    expect(tableScope.getByRole('columnheader', { name: 'Status' })).toBeVisible()
    expect(tableScope.getByRole('columnheader', { name: 'Priority' })).toBeVisible()
    expect(tableScope.getByRole('columnheader', { name: 'Assignee' })).toBeVisible()
    expect(tableScope.getByRole('columnheader', { name: 'Updated' })).toBeVisible()
    expect(tableScope.getAllByRole('row')).toHaveLength(11)
    expect(tableScope.getByText('SD-1048')).toBeVisible()
    expect(tableScope.getByText('Atlas & Pine')).toBeVisible()
    expect(screen.getByRole('status')).toHaveTextContent(
      '10 tickets are ready for review.',
    )
  })

  it('keeps the workspace visible while ticket results are loading', () => {
    render(
      <App repository={createTicketRepository({ defaultLatencyMs: 10_000 })} />,
    )

    expect(screen.getByRole('region', { name: 'Ticket controls' })).toBeVisible()
    expect(screen.getByRole('region', { name: 'Ticket results' })).toHaveAttribute(
      'aria-busy',
      'true',
    )
    expect(screen.getByRole('heading', { name: 'Gathering the queue' })).toBeVisible()
    expect(screen.getByRole('status')).toHaveTextContent(
      'Loading the ticket queue…',
    )
  })

  it('explains a valid empty queue', async () => {
    render(
      <App
        repository={createTicketRepository({
          initialTickets: [],
          defaultLatencyMs: 0,
        })}
      />,
    )

    expect(
      await screen.findByRole('heading', { name: 'No tickets in this queue' }),
    ).toBeVisible()
    expect(screen.queryByRole('table')).not.toBeInTheDocument()
    expect(screen.getByRole('status')).toHaveTextContent(
      'No tickets match the current queue view.',
    )
  })

  it('offers a retry after failure and moves focus to recovered results', async () => {
    const user = userEvent.setup()
    render(
      <App
        repository={createTicketRepository({
          defaultLatencyMs: 0,
          plans: {
            listTickets: [
              { latencyMs: 0, fault: { message: 'Planned failure.' } },
              { latencyMs: 0 },
            ],
          },
        })}
      />,
    )

    const alert = await screen.findByRole('alert')
    expect(alert).toHaveTextContent('Ticket results are unavailable')
    const retry = screen.getByRole('button', { name: 'Retry loading tickets' })
    await user.click(retry)

    expect(await screen.findByRole('table')).toBeVisible()
    expect(screen.getByRole('heading', { name: 'Ticket results' })).toHaveFocus()
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('searches meaningful ticket text and restores the queue when cleared', async () => {
    const user = userEvent.setup()
    render(
      <App repository={createTicketRepository({ defaultLatencyMs: 0 })} />,
    )
    await screen.findByRole('table')

    const search = screen.getByRole('searchbox', { name: 'Search tickets' })
    expect(search).toHaveAccessibleDescription(
      'Find a title, customer, ticket ID, or tag.',
    )
    expect(
      screen.queryByRole('button', { name: 'Clear search' }),
    ).not.toBeInTheDocument()

    await user.type(search, 'Atlas & Pine')
    expect(search).toHaveValue('Atlas & Pine')
    expect(
      await screen.findByRole('table', {
        name: /showing 1 of 1/,
      }),
    ).toBeVisible()
    expect(screen.getByText('Invoice shows duplicate annual charge')).toBeVisible()

    await user.click(screen.getByRole('button', { name: 'Clear search' }))
    expect(search).toHaveValue('')
    expect(
      await screen.findByRole('table', {
        name: /showing 10 of 24/,
      }),
    ).toBeVisible()
  })

  it('keeps the newest search intent when an older response finishes later', async () => {
    const user = userEvent.setup()
    render(
      <App
        repository={createTicketRepository({
          defaultLatencyMs: 0,
          plans: {
            listTickets: [
              { latencyMs: 0 },
              { latencyMs: 120 },
              { latencyMs: 5 },
            ],
          },
        })}
      />,
    )
    await screen.findByRole('table')
    const search = screen.getByRole('searchbox', { name: 'Search tickets' })

    await user.type(search, 'z')
    await user.clear(search)

    expect(
      await screen.findByRole('table', { name: /showing 10 of 24/ }),
    ).toBeVisible()
    await new Promise((resolve) => setTimeout(resolve, 140))
    expect(search).toHaveValue('')
    expect(screen.queryByText('No tickets match this view')).not.toBeInTheDocument()
    expect(screen.getByRole('table')).toHaveAccessibleName(
      /showing 10 of 24/,
    )
  })

  it('combines search with multiple-value filters and clears filters explicitly', async () => {
    const user = userEvent.setup()
    render(
      <App repository={createTicketRepository({ defaultLatencyMs: 0 })} />,
    )
    await screen.findByRole('table')

    const search = screen.getByRole('searchbox', { name: 'Search tickets' })
    await user.type(search, 'Billing')
    expect(
      await screen.findByRole('table', { name: /showing 5 of 5/ }),
    ).toBeVisible()

    await user.click(screen.getByRole('checkbox', { name: 'New' }))
    await user.click(screen.getByRole('checkbox', { name: 'Open' }))
    await user.click(screen.getByRole('checkbox', { name: 'Urgent' }))

    expect(
      await screen.findByRole('table', { name: /showing 2 of 2/ }),
    ).toBeVisible()
    expect(screen.getByText('Invoice shows duplicate annual charge')).toBeVisible()
    expect(
      screen.getByText(/3 active filters: Status New, Open; Priority Urgent/),
    ).toBeVisible()

    await user.click(screen.getByRole('button', { name: 'Clear search' }))
    expect(
      await screen.findByRole('table', { name: /showing 3 of 3/ }),
    ).toBeVisible()

    await user.click(screen.getByRole('button', { name: 'Clear all filters' }))
    expect(
      await screen.findByRole('table', { name: /showing 10 of 24/ }),
    ).toBeVisible()
    expect(screen.getByText('No status or priority filters are active.')).toBeVisible()
    expect(
      screen.queryByRole('button', { name: 'Clear all filters' }),
    ).not.toBeInTheDocument()
  })

  it('sorts columns in both directions with accessible, stable ordering', async () => {
    const user = userEvent.setup()
    render(
      <App repository={createTicketRepository({ defaultLatencyMs: 0 })} />,
    )
    let table = await screen.findByRole('table')
    let tableScope = within(table)

    expect(
      tableScope.getByRole('columnheader', { name: 'Updated' }),
    ).toHaveAttribute('aria-sort', 'descending')
    expect(
      tableScope
        .getAllByRole('rowheader')
        .slice(0, 5)
        .map((header) => header.textContent?.slice(0, 7)),
    ).toEqual(['SD-1048', 'SD-1062', 'SD-1086', 'SD-1128', 'SD-1160'])

    await user.click(tableScope.getByRole('button', { name: 'Ticket' }))
    table = await screen.findByRole('table')
    tableScope = within(table)
    expect(
      tableScope.getByRole('columnheader', { name: 'Ticket' }),
    ).toHaveAttribute('aria-sort', 'ascending')
    expect(tableScope.getAllByRole('rowheader')[0]).toHaveTextContent(
      'Can guests comment without edit access?',
    )
    expect(screen.getByText('Sorted by Ticket title · Ascending')).toBeVisible()

    await user.click(tableScope.getByRole('button', { name: 'Ticket' }))
    table = await screen.findByRole('table')
    tableScope = within(table)
    expect(
      tableScope.getByRole('columnheader', { name: 'Ticket' }),
    ).toHaveAttribute('aria-sort', 'descending')
    expect(tableScope.getAllByRole('rowheader')[0]).toHaveTextContent(
      'Workspace import needs field mapping help',
    )
  })

  it('navigates valid pages and resets a reduced result set to page one', async () => {
    const user = userEvent.setup()
    render(
      <App repository={createTicketRepository({ defaultLatencyMs: 0 })} />,
    )

    expect(await screen.findByText('Page 1 of 3 · 24 results')).toBeVisible()
    const previous = screen.getByRole('button', { name: 'Previous page' })
    const next = screen.getByRole('button', { name: 'Next page' })
    expect(previous).toBeDisabled()
    expect(next).toBeEnabled()

    await user.click(screen.getByRole('button', { name: 'Ticket' }))
    await screen.findByText('Sorted by Ticket title · Ascending')
    await user.click(next)
    expect(await screen.findByText('Page 2 of 3 · 24 results')).toBeVisible()
    expect(previous).toBeEnabled()
    expect(next).toBeEnabled()
    expect(screen.getByText('Sorted by Ticket title · Ascending')).toBeVisible()

    await user.click(next)
    expect(await screen.findByText('Page 3 of 3 · 24 results')).toBeVisible()
    expect(previous).toBeEnabled()
    expect(next).toBeDisabled()

    const search = screen.getByRole('searchbox', { name: 'Search tickets' })
    await user.type(search, 'Billing')
    expect(await screen.findByText('Page 1 of 1 · 5 results')).toBeVisible()
    expect(search).toHaveValue('Billing')
    expect(screen.getByText('Sorted by Ticket title · Ascending')).toBeVisible()
    expect(previous).toBeDisabled()
    expect(next).toBeDisabled()
  })

  it('restores search, filters, and sorting from a direct URL', async () => {
    window.history.replaceState(
      null,
      '',
      '/?q=Billing&status=new&status=open&priority=urgent&sort=title&dir=asc',
    )
    render(
      <App repository={createTicketRepository({ defaultLatencyMs: 0 })} />,
    )

    expect(screen.getByRole('searchbox', { name: 'Search tickets' })).toHaveValue(
      'Billing',
    )
    expect(screen.getByRole('checkbox', { name: 'New' })).toBeChecked()
    expect(screen.getByRole('checkbox', { name: 'Open' })).toBeChecked()
    expect(screen.getByRole('checkbox', { name: 'Urgent' })).toBeChecked()
    expect(
      await screen.findByRole('table', { name: /showing 2 of 2/ }),
    ).toBeVisible()
    expect(screen.getByText('Sorted by Ticket title · Ascending')).toBeVisible()
  })

  it('restores a valid page and normalizes malformed URL values', async () => {
    window.history.replaceState(null, '', '/?sort=title&dir=asc&page=2')
    const { unmount } = render(
      <App repository={createTicketRepository({ defaultLatencyMs: 0 })} />,
    )
    expect(await screen.findByText('Page 2 of 3 · 24 results')).toBeVisible()
    unmount()

    window.history.replaceState(
      null,
      '',
      '/?status=invalid&priority=critical&sort=random&dir=sideways&page=-8',
    )
    render(
      <App repository={createTicketRepository({ defaultLatencyMs: 0 })} />,
    )
    expect(
      await screen.findByRole('table', { name: /showing 10 of 24/ }),
    ).toBeVisible()
    await waitFor(() => expect(window.location.search).toBe(''))
    expect(screen.getByText('Sorted by Updated time · Descending')).toBeVisible()
  })

  it('uses intentional history so Back and Forward restore filter state', async () => {
    const user = userEvent.setup()
    render(
      <App repository={createTicketRepository({ defaultLatencyMs: 0 })} />,
    )
    await screen.findByRole('table')

    const initialHistoryLength = window.history.length
    const search = screen.getByRole('searchbox', { name: 'Search tickets' })
    await user.type(search, 'bug')
    expect(window.history.length).toBe(initialHistoryLength)
    expect(new URLSearchParams(window.location.search).get('q')).toBe('bug')
    await user.click(screen.getByRole('button', { name: 'Clear search' }))

    await user.click(screen.getByRole('checkbox', { name: 'New' }))
    await screen.findByRole('table', { name: /showing 5 of 5/ })
    await user.click(screen.getByRole('checkbox', { name: 'Open' }))
    await screen.findByText(/2 active filters: Status New, Open/)

    await act(async () => {
      const popped = new Promise<void>((resolve) =>
        window.addEventListener('popstate', () => resolve(), { once: true }),
      )
      window.history.back()
      await popped
    })
    await waitFor(() => {
      expect(screen.getByRole('checkbox', { name: 'New' })).toBeChecked()
      expect(screen.getByRole('checkbox', { name: 'Open' })).not.toBeChecked()
    })

    await act(async () => {
      const popped = new Promise<void>((resolve) =>
        window.addEventListener('popstate', () => resolve(), { once: true }),
      )
      window.history.forward()
      await popped
    })
    await waitFor(() => {
      expect(screen.getByRole('checkbox', { name: 'New' })).toBeChecked()
      expect(screen.getByRole('checkbox', { name: 'Open' })).toBeChecked()
    })
  })

  it('keeps ticket selection stable across sort, page, and filter changes', async () => {
    const user = userEvent.setup()
    render(
      <App repository={createTicketRepository({ defaultLatencyMs: 0 })} />,
    )
    await screen.findByRole('table')

    const selectedTicketName =
      'Select SD-1048: Invoice shows duplicate annual charge'
    await user.click(screen.getByRole('checkbox', { name: selectedTicketName }))
    expect(screen.getByText('1 ticket selected')).toBeVisible()

    await user.click(screen.getByRole('button', { name: 'Ticket' }))
    await screen.findByText('Sorted by Ticket title · Ascending')
    await screen.findByText('10 tickets are ready for review.')
    expect(screen.getByRole('checkbox', { name: selectedTicketName })).toBeChecked()

    await user.click(screen.getByRole('button', { name: 'Next page' }))
    expect(await screen.findByText('Page 2 of 3 · 24 results')).toBeVisible()
    expect(
      screen.queryByRole('checkbox', { name: selectedTicketName }),
    ).not.toBeInTheDocument()
    expect(screen.getByText('1 ticket selected')).toBeVisible()

    await user.click(screen.getByRole('checkbox', { name: 'Resolved' }))
    expect(await screen.findByText('Page 1 of 1 · 5 results')).toBeVisible()
    expect(
      screen.queryByRole('checkbox', { name: selectedTicketName }),
    ).not.toBeInTheDocument()
    expect(screen.getByText('1 ticket selected')).toBeVisible()

    await user.click(screen.getByRole('button', { name: 'Clear all filters' }))
    expect(
      await screen.findByRole('checkbox', { name: selectedTicketName }),
    ).toBeChecked()

    await user.click(screen.getByRole('button', { name: 'Clear selection' }))
    expect(screen.getByText('0 tickets selected')).toBeVisible()
    expect(screen.getByRole('checkbox', { name: selectedTicketName })).not.toBeChecked()
    expect(
      screen.queryByRole('button', { name: 'Clear selection' }),
    ).not.toBeInTheDocument()
  })

  it('selects only visible tickets with accurate partial and hidden states', async () => {
    const user = userEvent.setup()
    render(
      <App repository={createTicketRepository({ defaultLatencyMs: 0 })} />,
    )
    await screen.findByRole('table')

    let selectVisible = screen.getByRole('checkbox', {
      name: 'Select all visible tickets',
    })
    expect(selectVisible).not.toBeChecked()
    expect(selectVisible).not.toBePartiallyChecked()

    await user.click(
      screen.getByRole('checkbox', {
        name: 'Select SD-1048: Invoice shows duplicate annual charge',
      }),
    )
    expect(selectVisible).toBePartiallyChecked()

    selectVisible.focus()
    await user.keyboard(' ')
    expect(selectVisible).toBeChecked()
    expect(selectVisible).not.toBePartiallyChecked()
    expect(screen.getByText('10 tickets selected')).toBeVisible()
    expect(screen.getByText('· 10 on this page')).toBeVisible()

    await user.click(screen.getByRole('button', { name: 'Next page' }))
    expect(await screen.findByText('Page 2 of 3 · 24 results')).toBeVisible()
    selectVisible = screen.getByRole('checkbox', {
      name: 'Select all visible tickets',
    })
    expect(selectVisible).not.toBeChecked()
    expect(screen.getByText('10 tickets selected')).toBeVisible()
    expect(screen.getByText('· 0 on this page, 10 outside this view')).toBeVisible()

    selectVisible.focus()
    await user.keyboard(' ')
    expect(selectVisible).toBeChecked()
    expect(screen.getByText('20 tickets selected')).toBeVisible()
    expect(screen.getByText('· 10 on this page, 10 outside this view')).toBeVisible()

    await user.click(screen.getByRole('button', { name: 'Previous page' }))
    expect(await screen.findByText('Page 1 of 3 · 24 results')).toBeVisible()
    selectVisible = screen.getByRole('checkbox', {
      name: 'Select all visible tickets',
    })
    expect(selectVisible).toBeChecked()
    await user.click(selectVisible)

    expect(selectVisible).not.toBeChecked()
    expect(screen.getByText('10 tickets selected')).toBeVisible()
    expect(screen.getByText('· 0 on this page, 10 outside this view')).toBeVisible()
  })

  it('applies one status to every selected ticket and clears selection on success', async () => {
    const user = userEvent.setup()
    render(
      <App repository={createTicketRepository({ defaultLatencyMs: 0 })} />,
    )
    await screen.findByRole('table')

    const apply = screen.getByRole('button', { name: 'Apply status' })
    expect(apply).toBeDisabled()
    await user.click(
      screen.getByRole('checkbox', {
        name: 'Select SD-1048: Invoice shows duplicate annual charge',
      }),
    )
    await user.click(
      screen.getByRole('checkbox', {
        name: 'Select SD-1062: Export finished with missing rows',
      }),
    )
    await user.selectOptions(
      screen.getByRole('combobox', {
        name: 'New status for selected tickets',
      }),
      'resolved',
    )
    await user.click(apply)

    expect(
      await screen.findByText(
        'Applied Resolved to 2 tickets. Selection cleared.',
      ),
    ).toBeVisible()
    expect(screen.getByText('0 tickets selected')).toBeVisible()
    expect(apply).toBeDisabled()

    for (const label of [
      'Select SD-1048: Invoice shows duplicate annual charge',
      'Select SD-1062: Export finished with missing rows',
    ]) {
      const checkbox = await screen.findByRole('checkbox', { name: label })
      const row = checkbox.closest('tr')
      expect(row).not.toBeNull()
      expect(within(row as HTMLTableRowElement).getByText('Resolved')).toBeVisible()
    }
  })

  it('locks conflicting controls while bulk work is pending and preserves selection on failure', async () => {
    const user = userEvent.setup()
    render(
      <App
        repository={createTicketRepository({
          defaultLatencyMs: 0,
          plans: {
            bulkUpdateStatus: [
              {
                latencyMs: 120,
                fault: { message: 'Planned bulk failure.' },
              },
            ],
          },
        })}
      />,
    )
    await screen.findByRole('table')

    const rowSelection = screen.getByRole('checkbox', {
      name: 'Select SD-1048: Invoice shows duplicate annual charge',
    })
    await user.click(rowSelection)
    const apply = screen.getByRole('button', { name: 'Apply status' })
    const statusChoice = screen.getByRole('combobox', {
      name: 'New status for selected tickets',
    })
    await user.click(apply)

    expect(screen.getByText('Updating 1 ticket…')).toBeVisible()
    expect(screen.getByRole('button', { name: 'Applying status…' })).toBeDisabled()
    expect(statusChoice).toBeDisabled()
    expect(rowSelection).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Clear selection' })).toBeDisabled()

    const alert = await screen.findByRole('alert')
    expect(alert).toHaveTextContent(
      'Bulk update failed. Your 1 selected ticket remains selected. Try again.',
    )
    expect(screen.getByText('1 ticket selected')).toBeVisible()
    expect(rowSelection).toBeChecked()
    expect(rowSelection).toBeEnabled()
    expect(statusChoice).toBeEnabled()
    expect(screen.getByRole('button', { name: 'Apply status' })).toBeEnabled()
    expect(
      screen.queryByText(/Selection cleared/),
    ).not.toBeInTheDocument()
  })

  it('loads and presents complete ticket details in an accessible dialog', async () => {
    const user = userEvent.setup()
    render(
      <App
        repository={createTicketRepository({
          defaultLatencyMs: 0,
          plans: { getTicket: [{ latencyMs: 80 }] },
        })}
      />,
    )
    await screen.findByRole('table')

    await user.click(
      screen.getByRole('button', {
        name: 'Open SD-1048 details: Invoice shows duplicate annual charge',
      }),
    )
    const loadingDialog = screen.getByRole('dialog', { name: 'Ticket details' })
    expect(within(loadingDialog).getByRole('status')).toHaveTextContent(
      'Loading SD-1048 details…',
    )

    const dialog = await screen.findByRole('dialog', {
      name: 'Invoice shows duplicate annual charge',
    })
    const dialogScope = within(dialog)
    expect(dialogScope.getByText('Atlas & Pine')).toBeVisible()
    expect(dialogScope.getByText('Unassigned')).toBeVisible()
    expect(dialogScope.getByRole('heading', { name: 'Description' })).toBeVisible()
    expect(dialogScope.getByRole('heading', { name: 'Tags' })).toBeVisible()
    expect(dialogScope.getByText('Billing')).toBeVisible()
    expect(dialogScope.getByRole('heading', { name: 'Activity' })).toBeVisible()
    expect(
      dialogScope.getByText('Ticket created from the customer support queue.'),
    ).toBeVisible()
  })

  it('retries a failed ticket detail request', async () => {
    const user = userEvent.setup()
    render(
      <App
        repository={createTicketRepository({
          defaultLatencyMs: 0,
          plans: {
            getTicket: [
              { latencyMs: 0, fault: { message: 'Planned detail failure.' } },
              { latencyMs: 0 },
            ],
          },
        })}
      />,
    )
    await screen.findByRole('table')
    await user.click(
      screen.getByRole('button', {
        name: 'Open SD-1062 details: Export finished with missing rows',
      }),
    )

    const alert = await screen.findByRole('alert')
    expect(alert).toHaveTextContent('Ticket details are unavailable')
    await user.click(
      within(screen.getByRole('dialog')).getByRole('button', {
        name: 'Retry ticket details',
      }),
    )
    expect(
      await screen.findByRole('dialog', {
        name: 'Export finished with missing rows',
      }),
    ).toBeVisible()
    expect(screen.queryByText('Ticket details are unavailable')).not.toBeInTheDocument()
  })

  it('closes details without changing the underlying list state', async () => {
    const user = userEvent.setup()
    render(
      <App repository={createTicketRepository({ defaultLatencyMs: 0 })} />,
    )
    await screen.findByRole('table')
    const search = screen.getByRole('searchbox', { name: 'Search tickets' })
    await user.type(search, 'Billing')
    await screen.findByRole('table', { name: /showing 5 of 5/ })

    await user.click(
      screen.getByRole('button', {
        name: 'Open SD-1048 details: Invoice shows duplicate annual charge',
      }),
    )
    await screen.findByRole('dialog', {
      name: 'Invoice shows duplicate annual charge',
    })
    await user.click(screen.getByRole('button', { name: 'Close details' }))

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(search).toHaveValue('Billing')
    expect(screen.getByRole('table')).toHaveAccessibleName(/showing 5 of 5/)
  })

  it('contains modal focus, closes with Escape, and restores the trigger', async () => {
    const user = userEvent.setup()
    render(
      <App
        repository={createTicketRepository({
          defaultLatencyMs: 0,
          plans: {
            getTicket: [
              { latencyMs: 0, fault: { message: 'Planned focus test.' } },
              { latencyMs: 0 },
            ],
          },
        })}
      />,
    )
    await screen.findByRole('table')
    const trigger = screen.getByRole('button', {
      name: 'Open SD-1048 details: Invoice shows duplicate annual charge',
    })
    await user.click(trigger)

    const dialog = await screen.findByRole('dialog')
    const close = within(dialog).getByRole('button', { name: 'Close details' })
    const retry = await within(dialog).findByRole('button', {
      name: 'Retry ticket details',
    })
    expect(close).toHaveFocus()

    await user.keyboard('{Shift>}{Tab}{/Shift}')
    expect(retry).toHaveFocus()
    await user.keyboard('{Tab}')
    expect(close).toHaveFocus()

    await user.keyboard('{Escape}')
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(trigger).toHaveFocus()

    await user.click(trigger)
    await screen.findByRole('dialog', {
      name: 'Invoice shows duplicate annual charge',
    })
    await user.click(screen.getByRole('button', { name: 'Close details' }))
    expect(trigger).toHaveFocus()
    expect(screen.getByRole('searchbox', { name: 'Search tickets' })).not.toHaveFocus()
  })

  it('edits every core field and restores saved values when editing is cancelled', async () => {
    const user = userEvent.setup()
    render(
      <App repository={createTicketRepository({ defaultLatencyMs: 0 })} />,
    )
    await screen.findByRole('table')
    await user.click(
      screen.getByRole('button', {
        name: 'Open SD-1048 details: Invoice shows duplicate annual charge',
      }),
    )
    let dialog = await screen.findByRole('dialog', {
      name: 'Invoice shows duplicate annual charge',
    })
    await user.click(within(dialog).getByRole('button', { name: 'Edit ticket' }))

    let dialogScope = within(dialog)
    const title = dialogScope.getByRole('textbox', { name: 'Title' })
    expect(title).toHaveFocus()
    expect(title).toHaveValue('Invoice shows duplicate annual charge')
    expect(dialogScope.getByRole('combobox', { name: 'Status' })).toHaveValue('new')
    expect(dialogScope.getByRole('combobox', { name: 'Priority' })).toHaveValue(
      'urgent',
    )
    expect(dialogScope.getByRole('combobox', { name: 'Assignee' })).toHaveValue('')
    expect(
      (dialogScope.getByRole('textbox', {
        name: 'Description',
      }) as HTMLTextAreaElement).value,
    ).toContain('finance team')
    expect(dialogScope.getByRole('group', { name: 'Tags' })).toBeVisible()

    await user.clear(title)
    await user.type(title, 'A draft title that should be discarded')
    await user.selectOptions(
      dialogScope.getByRole('combobox', { name: 'Status' }),
      'open',
    )
    await user.selectOptions(
      dialogScope.getByRole('combobox', { name: 'Priority' }),
      'normal',
    )
    await user.selectOptions(
      dialogScope.getByRole('combobox', { name: 'Assignee' }),
      'agent-amina',
    )
    await user.click(dialogScope.getByRole('checkbox', { name: 'Bug' }))
    await user.click(dialogScope.getByRole('button', { name: 'Cancel editing' }))

    expect(dialogScope.getByRole('button', { name: 'Edit ticket' })).toHaveFocus()
    await user.click(dialogScope.getByRole('button', { name: 'Edit ticket' }))
    dialog = screen.getByRole('dialog')
    dialogScope = within(dialog)
    expect(dialogScope.getByRole('textbox', { name: 'Title' })).toHaveValue(
      'Invoice shows duplicate annual charge',
    )
    expect(dialogScope.getByRole('combobox', { name: 'Status' })).toHaveValue('new')
    expect(dialogScope.getByRole('combobox', { name: 'Assignee' })).toHaveValue('')
    expect(dialogScope.getByRole('checkbox', { name: 'Bug' })).not.toBeChecked()
  })

  it('saves edited fields and reconciles the dialog with the ticket row', async () => {
    const user = userEvent.setup()
    render(
      <App repository={createTicketRepository({ defaultLatencyMs: 0 })} />,
    )
    await screen.findByRole('table')
    await user.click(
      screen.getByRole('button', {
        name: 'Open SD-1048 details: Invoice shows duplicate annual charge',
      }),
    )
    const dialog = await screen.findByRole('dialog', {
      name: 'Invoice shows duplicate annual charge',
    })
    const dialogScope = within(dialog)
    await user.click(dialogScope.getByRole('button', { name: 'Edit ticket' }))

    const title = dialogScope.getByRole('textbox', { name: 'Title' })
    await user.clear(title)
    await user.type(title, 'Corrected annual invoice charge')
    await user.selectOptions(
      dialogScope.getByRole('combobox', { name: 'Status' }),
      'open',
    )
    await user.selectOptions(
      dialogScope.getByRole('combobox', { name: 'Priority' }),
      'high',
    )
    await user.selectOptions(
      dialogScope.getByRole('combobox', { name: 'Assignee' }),
      'agent-amina',
    )
    await user.click(dialogScope.getByRole('checkbox', { name: 'Bug' }))
    await user.click(dialogScope.getByRole('button', { name: 'Save ticket' }))

    expect(
      await screen.findByRole('dialog', {
        name: 'Corrected annual invoice charge',
      }),
    ).toBeVisible()
    expect(dialogScope.getByText('Amina Rahal')).toBeVisible()
    expect(dialogScope.getByText('Bug')).toBeVisible()
    expect(dialogScope.getByRole('button', { name: 'Edit ticket' })).toHaveFocus()
    expect(
      await screen.findByRole('button', {
        name: 'Open SD-1048 details: Corrected annual invoice charge',
      }),
    ).toBeVisible()
  })

  it('associates multiple edit errors and preserves the draft while correcting them', async () => {
    const user = userEvent.setup()
    render(
      <App repository={createTicketRepository({ defaultLatencyMs: 0 })} />,
    )
    await screen.findByRole('table')
    await user.click(
      screen.getByRole('button', {
        name: 'Open SD-1048 details: Invoice shows duplicate annual charge',
      }),
    )
    const dialog = await screen.findByRole('dialog')
    const dialogScope = within(dialog)
    await user.click(dialogScope.getByRole('button', { name: 'Edit ticket' }))

    const title = dialogScope.getByRole('textbox', { name: 'Title' })
    const description = dialogScope.getByRole('textbox', {
      name: 'Description',
    })
    const priority = dialogScope.getByRole('combobox', { name: 'Priority' })
    await user.clear(title)
    await user.type(title, 'No')
    await user.clear(description)
    await user.selectOptions(priority, 'high')
    await user.click(dialogScope.getByRole('button', { name: 'Save ticket' }))

    const summary = dialogScope.getByRole('alert')
    expect(summary).toHaveFocus()
    expect(summary).toHaveTextContent('Fix 2 errors before saving')
    expect(summary).toHaveTextContent('Title must be at least 4 characters.')
    expect(summary).toHaveTextContent('Enter a ticket description.')
    expect(title).toHaveAttribute('aria-invalid', 'true')
    expect(title).toHaveAccessibleDescription(
      /4–120 characters Title must be at least 4 characters/,
    )
    expect(description).toHaveAttribute('aria-invalid', 'true')
    expect(description).toHaveAccessibleDescription(
      /20–2,000 characters Enter a ticket description/,
    )

    await user.clear(title)
    await user.type(title, 'Corrected invoice title')
    expect(title).not.toHaveAttribute('aria-invalid')
    expect(dialogScope.getByRole('alert')).toHaveTextContent(
      'Fix 1 error before saving',
    )
    expect(description).toHaveValue('')
    expect(priority).toHaveValue('high')

    await user.type(description, 'Still short')
    expect(dialogScope.getByRole('alert')).toHaveTextContent(
      'Description must be at least 20 characters.',
    )
    await user.clear(description)
    await user.type(
      description,
      'The finance team confirmed the corrected invoice details.',
    )
    expect(description).not.toHaveAttribute('aria-invalid')
    expect(dialogScope.queryByRole('alert')).not.toBeInTheDocument()
    expect(priority).toHaveValue('high')

    await user.click(dialogScope.getByRole('button', { name: 'Save ticket' }))
    expect(
      await screen.findByRole('dialog', { name: 'Corrected invoice title' }),
    ).toBeVisible()
  })

  it('keeps the list and dialog optimistically aligned during one guarded save', async () => {
    const user = userEvent.setup()
    const repository = createTicketRepository({ defaultLatencyMs: 0 })
    const updateTicket = repository.updateTicket.bind(repository)
    let releaseUpdate: (() => void) | undefined
    const updateGate = new Promise<void>((resolve) => {
      releaseUpdate = resolve
    })
    const updateSpy = vi
      .spyOn(repository, 'updateTicket')
      .mockImplementation(async (command, options) => {
        await updateGate
        return updateTicket(command, options)
      })

    render(<App repository={repository} />)
    await screen.findByRole('table')
    await user.click(
      screen.getByRole('button', {
        name: 'Open SD-1048 details: Invoice shows duplicate annual charge',
      }),
    )
    const dialog = await screen.findByRole('dialog')
    const dialogScope = within(dialog)
    await user.click(dialogScope.getByRole('button', { name: 'Edit ticket' }))
    const title = dialogScope.getByRole('textbox', { name: 'Title' })
    await user.clear(title)
    await user.type(title, 'Optimistic invoice correction')
    await user.selectOptions(
      dialogScope.getByRole('combobox', { name: 'Status' }),
      'open',
    )
    const saveButton = dialogScope.getByRole('button', { name: 'Save ticket' })
    const editForm = saveButton.closest('form')
    if (!editForm) throw new Error('Expected the ticket edit form.')

    await user.click(saveButton)

    const optimisticTrigger = await screen.findByRole('button', {
      name: 'Open SD-1048 details: Optimistic invoice correction',
    })
    const optimisticRow = optimisticTrigger.closest('tr')
    if (!optimisticRow) throw new Error('Expected an optimistic ticket row.')
    expect(within(optimisticRow).getByText('Open')).toBeVisible()
    expect(
      screen.getByRole('dialog', { name: 'Optimistic invoice correction' }),
    ).toBeVisible()
    expect(
      dialogScope.getByRole('button', { name: 'Saving ticket…' }),
    ).toBeDisabled()

    fireEvent.submit(editForm)
    expect(updateSpy).toHaveBeenCalledTimes(1)

    await act(async () => {
      releaseUpdate?.()
    })
    expect(
      await dialogScope.findByRole('button', { name: 'Edit ticket' }),
    ).toBeVisible()
    expect(updateSpy).toHaveBeenCalledTimes(1)
    expect(
      screen.getByRole('button', {
        name: 'Open SD-1048 details: Optimistic invoice correction',
      }),
    ).toBeVisible()
  })

  it('rolls back a failed save while retaining the draft for retry', async () => {
    const user = userEvent.setup()
    const repository = createTicketRepository({
      defaultLatencyMs: 0,
      plans: {
        updateTicket: [
          { fault: { message: 'The local repository is unavailable.' } },
          {},
        ],
      },
    })
    render(<App repository={repository} />)
    await screen.findByRole('table')
    await user.click(
      screen.getByRole('button', {
        name: 'Open SD-1048 details: Invoice shows duplicate annual charge',
      }),
    )
    const dialog = await screen.findByRole('dialog')
    const dialogScope = within(dialog)
    await user.click(dialogScope.getByRole('button', { name: 'Edit ticket' }))
    const title = dialogScope.getByRole('textbox', { name: 'Title' })
    await user.clear(title)
    await user.type(title, 'Retained invoice recovery draft')
    await user.click(dialogScope.getByRole('button', { name: 'Save ticket' }))

    const saveError = await dialogScope.findByRole('alert')
    expect(saveError).toHaveTextContent('Ticket save failed')
    expect(saveError).toHaveTextContent('Your draft is still here')
    expect(title).toHaveValue('Retained invoice recovery draft')
    expect(
      screen.getByRole('button', {
        name: 'Open SD-1048 details: Invoice shows duplicate annual charge',
      }),
    ).toBeVisible()

    await user.click(dialogScope.getByRole('button', { name: 'Retry save' }))
    expect(
      await screen.findByRole('dialog', {
        name: 'Retained invoice recovery draft',
      }),
    ).toBeVisible()
    expect(
      screen.getByRole('button', {
        name: 'Open SD-1048 details: Retained invoice recovery draft',
      }),
    ).toBeVisible()
  })

  it('surfaces a version conflict, adopts newer data, and retries the retained draft', async () => {
    const user = userEvent.setup()
    const repository = createTicketRepository({ defaultLatencyMs: 0 })
    render(<App repository={repository} />)
    await screen.findByRole('table')
    await user.click(
      screen.getByRole('button', {
        name: 'Open SD-1048 details: Invoice shows duplicate annual charge',
      }),
    )
    const dialog = await screen.findByRole('dialog')
    const dialogScope = within(dialog)
    await user.click(dialogScope.getByRole('button', { name: 'Edit ticket' }))
    const title = dialogScope.getByRole('textbox', { name: 'Title' })
    await user.clear(title)
    await user.type(title, 'Agent invoice resolution draft')

    const currentTicket = await repository.getTicket('SD-1048')
    const teammateTicket = await repository.updateTicket({
      id: currentTicket.id,
      expectedVersion: currentTicket.version,
      changes: { title: 'Teammate invoice correction' },
    })
    await user.click(dialogScope.getByRole('button', { name: 'Save ticket' }))

    const conflict = await dialogScope.findByRole('alert')
    expect(conflict).toHaveTextContent('Review a newer ticket version')
    expect(conflict).toHaveTextContent(`now version ${teammateTicket.version}`)
    expect(conflict).toHaveTextContent('Teammate invoice correction')
    expect(title).toHaveValue('Agent invoice resolution draft')
    expect(
      screen.getByRole('button', {
        name: 'Open SD-1048 details: Teammate invoice correction',
      }),
    ).toBeVisible()

    await user.click(dialogScope.getByRole('button', { name: 'Retry save' }))
    expect(
      await screen.findByRole('dialog', {
        name: 'Agent invoice resolution draft',
      }),
    ).toBeVisible()
    expect(
      screen.getByRole('button', {
        name: 'Open SD-1048 details: Agent invoice resolution draft',
      }),
    ).toBeVisible()
  })

  it('does not let an earlier failed save clear a later optimistic action', async () => {
    const user = userEvent.setup()
    const repository = createTicketRepository({ defaultLatencyMs: 0 })
    const updateTicket = repository.updateTicket.bind(repository)
    let releaseFirst: (() => void) | undefined
    let releaseSecond: (() => void) | undefined
    const firstGate = new Promise<void>((resolve) => {
      releaseFirst = resolve
    })
    const secondGate = new Promise<void>((resolve) => {
      releaseSecond = resolve
    })
    let callCount = 0
    const updateSpy = vi
      .spyOn(repository, 'updateTicket')
      .mockImplementation(async (command, options) => {
        callCount += 1
        if (callCount === 1) {
          await firstGate
          throw new Error('The earlier save failed.')
        }
        await secondGate
        return updateTicket(command, options)
      })

    render(<App repository={repository} />)
    await screen.findByRole('table')
    await user.click(
      screen.getByRole('button', {
        name: 'Open SD-1048 details: Invoice shows duplicate annual charge',
      }),
    )
    let dialog = await screen.findByRole('dialog')
    let dialogScope = within(dialog)
    await user.click(dialogScope.getByRole('button', { name: 'Edit ticket' }))
    let title = dialogScope.getByRole('textbox', { name: 'Title' })
    await user.clear(title)
    await user.type(title, 'Earlier invoice draft')
    await user.click(dialogScope.getByRole('button', { name: 'Save ticket' }))
    await screen.findByRole('button', {
      name: 'Open SD-1048 details: Earlier invoice draft',
    })
    await user.click(dialogScope.getByRole('button', { name: 'Close details' }))

    await user.click(
      screen.getByRole('button', {
        name: 'Open SD-1048 details: Earlier invoice draft',
      }),
    )
    dialog = await screen.findByRole('dialog')
    dialogScope = within(dialog)
    await user.click(
      await dialogScope.findByRole('button', { name: 'Edit ticket' }),
    )
    title = dialogScope.getByRole('textbox', { name: 'Title' })
    await user.clear(title)
    await user.type(title, 'Later successful invoice action')
    await user.click(dialogScope.getByRole('button', { name: 'Save ticket' }))
    expect(updateSpy).toHaveBeenCalledTimes(2)

    await act(async () => {
      releaseFirst?.()
      await firstGate
    })
    expect(
      screen.getByRole('button', {
        name: 'Open SD-1048 details: Later successful invoice action',
      }),
    ).toBeVisible()
    expect(
      screen.getByRole('dialog', {
        name: 'Later successful invoice action',
      }),
    ).toBeVisible()
    expect(
      dialogScope.getByRole('button', { name: 'Saving ticket…' }),
    ).toBeDisabled()

    await act(async () => {
      releaseSecond?.()
      await secondGate
    })
    expect(
      await dialogScope.findByRole('button', { name: 'Edit ticket' }),
    ).toBeVisible()
    expect(
      screen.getByRole('button', {
        name: 'Open SD-1048 details: Later successful invoice action',
      }),
    ).toBeVisible()
  })
})
