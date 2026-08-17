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
})
