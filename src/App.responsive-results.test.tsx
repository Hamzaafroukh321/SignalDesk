import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it } from 'vitest'
import { App } from './App'
import { createTicketRepository } from './data/ticketRepository'

const selectedTicket = {
  id: 'SD-1048',
  title: 'Invoice shows duplicate annual charge',
}

function selectedTicketCheckbox() {
  return screen.getByRole('checkbox', {
    name: `Select ${selectedTicket.id}: ${selectedTicket.title}`,
  })
}

function selectedTicketTrigger() {
  return screen.getByRole('button', {
    name: `Open ${selectedTicket.id} details: ${selectedTicket.title}`,
  })
}

describe('responsive ticket result structure', () => {
  beforeEach(() => {
    window.history.replaceState(null, '', '/')
    window.localStorage.clear()
  })

  it('keeps one semantic, fully labelled control and row tree', async () => {
    render(
      <App repository={createTicketRepository({ defaultLatencyMs: 0 })} />,
    )
    const table = await screen.findByRole('table')
    const tableScope = within(table)

    expect(screen.getAllByRole('table')).toHaveLength(1)
    expect(table).toHaveAccessibleName(/Current ticket queue — showing 10 of 24/)
    expect(
      tableScope.getByRole('checkbox', { name: 'Select all visible tickets' }),
    ).toHaveAccessibleDescription(/0 tickets selected/)
    const sortLabels = ['Ticket', 'Status', 'Priority', 'Updated']
    sortLabels.forEach((label) => {
      expect(tableScope.getAllByRole('button', { name: label })).toHaveLength(1)
    })
    expect(
      tableScope.getByRole('columnheader', { name: 'Updated' }),
    ).toHaveAttribute('aria-sort', 'descending')

    const rows = tableScope.getAllByRole('row').slice(1)
    expect(rows).toHaveLength(10)
    rows.forEach((row) => {
      expect(within(row).getAllByRole('checkbox')).toHaveLength(1)
      expect(
        within(row).getByRole('button', { name: /^Open SD-\d+ details:/ }),
      ).toBeVisible()
      const labels = [...row.querySelectorAll('.mobile-cell-label')]
      expect(labels.map((label) => label.textContent?.trim())).toEqual([
        'Customer',
        'Status',
        'Priority',
        'Assignee',
        'Updated',
      ])
      labels.forEach((label) => expect(label).toHaveAttribute('aria-hidden', 'true'))
      expect(row.querySelector('[class*="status-"]')).toHaveTextContent(/\S/)
      expect(row.querySelector('[class*="priority-"]')).toHaveTextContent(/\S/)
    })

    expect(table.querySelectorAll('.select-page-label')).toHaveLength(1)
    expect(table.querySelector('.select-page-label')).toHaveAttribute(
      'aria-hidden',
      'true',
    )
    const triggers = [...table.querySelectorAll('[data-ticket-detail-trigger]')]
    expect(triggers).toHaveLength(10)
    expect(
      new Set(triggers.map((trigger) => trigger.getAttribute('data-ticket-detail-trigger')))
        .size,
    ).toBe(10)

    const ids = [...document.querySelectorAll<HTMLElement>('[id]')].map(
      (element) => element.id,
    )
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('preserves selection and exact detail focus through responsive-safe sorting', async () => {
    const user = userEvent.setup()
    render(
      <App repository={createTicketRepository({ defaultLatencyMs: 0 })} />,
    )
    await screen.findByRole('table')

    await user.click(selectedTicketCheckbox())
    expect(selectedTicketCheckbox()).toBeChecked()
    await user.click(screen.getByRole('button', { name: 'Status' }))
    expect(
      await screen.findByText('Sorted by Status · Ascending'),
    ).toBeVisible()
    expect(selectedTicketCheckbox()).toBeChecked()

    const trigger = selectedTicketTrigger()
    await user.click(trigger)
    const dialog = await screen.findByRole('dialog', {
      name: selectedTicket.title,
    })
    await user.click(within(dialog).getByRole('button', { name: 'Close details' }))

    expect(trigger).toHaveFocus()
    expect(selectedTicketCheckbox()).toBeChecked()
    expect(screen.getAllByRole('button', {
      name: `Open ${selectedTicket.id} details: ${selectedTicket.title}`,
    })).toHaveLength(1)
  })
})
