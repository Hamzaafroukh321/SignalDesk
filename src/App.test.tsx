import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { App } from './App'
import { createTicketRepository } from './data/ticketRepository'

describe('SignalDesk application shell', () => {
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
})
