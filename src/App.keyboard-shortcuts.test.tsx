import { StrictMode } from 'react'
import {
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

const ticket = {
  id: 'SD-1048',
  title: 'Invoice shows duplicate annual charge',
}

function ticketTrigger() {
  return screen.getByRole('button', {
    name: `Open ${ticket.id} details: ${ticket.title}`,
  })
}

describe('discoverable keyboard shortcuts', () => {
  beforeEach(() => {
    window.history.replaceState(null, '', '/')
    window.localStorage.clear()
  })

  it('describes shortcuts and focuses search with an unmodified slash', async () => {
    const user = userEvent.setup()
    render(
      <App repository={createTicketRepository({ defaultLatencyMs: 0 })} />,
    )
    const table = await screen.findByRole('table')
    const controls = screen.getByRole('region', { name: 'Ticket controls' })
    const search = within(controls).getByRole('searchbox', {
      name: 'Search tickets',
    })

    expect(within(controls).getByText('Keyboard shortcuts')).toBeVisible()
    expect(within(controls).getByText('/', { selector: 'kbd' })).toBeVisible()
    expect(within(controls).getByText('Esc', { selector: 'kbd' })).toBeVisible()
    expect(controls).toHaveTextContent('Focus search')
    expect(controls).toHaveTextContent('Close details or return to editing')
    expect(search).toHaveAttribute('aria-keyshortcuts', '/')

    const sort = within(table).getByRole('button', { name: 'Ticket' })
    sort.focus()
    await user.keyboard('/')

    expect(search).toHaveFocus()
    expect(search).toHaveValue('')

    sort.focus()
    fireEvent.keyDown(sort, { key: '/', shiftKey: true })
    expect(search).toHaveFocus()
  })

  it('leaves slash typing and modified shortcuts inside their normal context', async () => {
    const user = userEvent.setup()
    render(
      <App repository={createTicketRepository({ defaultLatencyMs: 0 })} />,
    )
    const table = await screen.findByRole('table')
    const search = screen.getByRole('searchbox', { name: 'Search tickets' })

    const sort = within(table).getByRole('button', { name: 'Ticket' })
    const ignoredEvents = [
      { ctrlKey: true },
      { altKey: true },
      { metaKey: true },
      { isComposing: true },
      { repeat: true },
    ]
    ignoredEvents.forEach((eventInit) => {
      sort.focus()
      fireEvent.keyDown(sort, { key: '/', ...eventInit })
      expect(sort).toHaveFocus()
    })
    sort.focus()
    fireEvent.keyDown(sort, { key: '?', shiftKey: true })
    expect(sort).toHaveFocus()

    await user.click(search)
    await user.type(search, '/')
    expect(search).toHaveValue('/')
    expect(search).toHaveFocus()

    const viewName = screen.getByRole('textbox', { name: 'View name' })
    await user.click(viewName)
    await user.type(viewName, '/')
    expect(viewName).toHaveValue('/')
    expect(viewName).toHaveFocus()

    const pageSize = screen.getByRole('combobox', {
      name: 'Tickets per page',
    })
    pageSize.focus()
    fireEvent.keyDown(pageSize, { key: '/' })
    expect(pageSize).toHaveFocus()
  })

  it('does not move focus behind details or steal slash from the note field', async () => {
    const user = userEvent.setup()
    render(
      <App repository={createTicketRepository({ defaultLatencyMs: 0 })} />,
    )
    await screen.findByRole('table')
    await user.click(ticketTrigger())

    const dialog = await screen.findByRole('dialog', { name: ticket.title })
    const close = within(dialog).getByRole('button', { name: 'Close details' })
    const search = screen.getByRole('searchbox', { name: 'Search tickets' })
    expect(close).toHaveAttribute('aria-keyshortcuts', 'Escape')
    expect(close).toHaveFocus()

    fireEvent.keyDown(close, { key: '/' })
    expect(close).toHaveFocus()
    expect(search).not.toHaveFocus()

    const note = within(dialog).getByRole('textbox', { name: 'Note' })
    await user.click(note)
    await user.type(note, '/')
    expect(note).toHaveValue('/')
    expect(note).toHaveFocus()
  })

  it('uses Escape to close details or return from discard confirmation', async () => {
    const user = userEvent.setup()
    render(
      <App repository={createTicketRepository({ defaultLatencyMs: 0 })} />,
    )
    await screen.findByRole('table')
    const trigger = ticketTrigger()

    await user.click(trigger)
    await screen.findByRole('dialog', { name: ticket.title })
    await user.keyboard('{Escape}')
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect(trigger).toHaveFocus()

    await user.click(trigger)
    let dialog = await screen.findByRole('dialog', { name: ticket.title })
    await user.click(within(dialog).getByRole('button', { name: 'Edit ticket' }))
    const title = within(dialog).getByRole('textbox', { name: 'Title' })
    const description = within(dialog).getByRole('textbox', {
      name: 'Description',
    })
    await user.type(title, ' protected shortcut draft')
    description.focus()
    await user.keyboard('{Escape}')

    expect(
      screen.getByRole('alertdialog', { name: 'Discard unsaved changes?' }),
    ).toBeVisible()
    await user.keyboard('{Escape}')
    dialog = screen.getByRole('dialog', { name: ticket.title })
    expect(within(dialog).getByRole('textbox', { name: 'Title' })).toHaveValue(
      `${ticket.title} protected shortcut draft`,
    )
    expect(description).toHaveFocus()
  })

  it('keeps one active listener in Strict Mode and removes it on unmount', async () => {
    const focus = vi.spyOn(HTMLInputElement.prototype, 'focus')
    const addEventListener = vi.spyOn(window, 'addEventListener')
    const removeEventListener = vi.spyOn(window, 'removeEventListener')

    try {
      const { unmount } = render(
        <StrictMode>
          <App repository={createTicketRepository({ defaultLatencyMs: 0 })} />
        </StrictMode>,
      )
      await screen.findByRole('table')
      const keydownListeners = addEventListener.mock.calls.filter(
        ([eventName]) => eventName === 'keydown',
      )
      const activeListener = keydownListeners.at(-1)?.[1]
      expect(activeListener).toBeDefined()

      focus.mockClear()
      fireEvent.keyDown(window, { key: '/' })
      expect(focus).toHaveBeenCalledTimes(1)

      unmount()
      expect(removeEventListener).toHaveBeenCalledWith(
        'keydown',
        activeListener,
      )
      fireEvent.keyDown(window, { key: '/' })
      expect(focus).toHaveBeenCalledTimes(1)
    } finally {
      focus.mockRestore()
      addEventListener.mockRestore()
      removeEventListener.mockRestore()
    }
  })
})
