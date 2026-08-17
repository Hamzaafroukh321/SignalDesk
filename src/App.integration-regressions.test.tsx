import { act, fireEvent, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { App } from './App'
import {
  createTicketRepository,
  type TicketListPage,
  type TicketRepository,
} from './data/ticketRepository'

const primaryTicket = {
  id: 'SD-1048',
  title: 'Invoice shows duplicate annual charge',
} as const

const secondaryTicket = {
  id: 'SD-1062',
  title: 'Export finished with missing rows',
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

function ticketTriggerName(ticket: typeof primaryTicket | typeof secondaryTicket) {
  return `Open ${ticket.id} details: ${ticket.title}`
}

function ticketSelectionName(ticket: typeof primaryTicket) {
  return `Select ${ticket.id}: ${ticket.title}`
}

describe('end-to-end integration regressions', () => {
  beforeEach(() => {
    window.history.replaceState(null, '', '/')
    window.localStorage.clear()
  })

  it('preserves selection across pagination and the latest search-filter response', async () => {
    const baseRepository = createTicketRepository({ defaultLatencyMs: 0 })
    const [olderPage, latestPage] = await Promise.all([
      baseRepository.listTickets({
        search: 'Billing',
        page: 1,
        pageSize: 5,
      }),
      baseRepository.listTickets({
        search: 'Billing',
        statuses: ['new'],
        page: 1,
        pageSize: 5,
      }),
    ])
    const olderRequest = createDeferred<TicketListPage>()
    const latestRequest = createDeferred<TicketListPage>()
    const olderStarted = createDeferred<void>()
    const latestStarted = createDeferred<void>()
    const repository: TicketRepository = {
      ...baseRepository,
      listTickets(query = {}, options) {
        const statuses = query.statuses ?? []
        if (query.search === 'Billing' && statuses.length === 0) {
          olderStarted.resolve(undefined)
          return olderRequest.promise
        }
        if (
          query.search === 'Billing' &&
          statuses.length === 1 &&
          statuses[0] === 'new'
        ) {
          latestStarted.resolve(undefined)
          return latestRequest.promise
        }
        return baseRepository.listTickets(query, options)
      },
    }
    const user = userEvent.setup()
    render(<App repository={repository} />)
    await screen.findByRole('table')

    const selectedTicketName = ticketSelectionName(primaryTicket)
    await user.click(
      screen.getByRole('checkbox', { name: selectedTicketName }),
    )
    await user.selectOptions(
      screen.getByRole('combobox', { name: 'Tickets per page' }),
      '5',
    )
    expect(await screen.findByText('Page 1 of 5 · 24 results')).toBeVisible()

    await user.click(screen.getByRole('button', { name: 'Next page' }))
    expect(await screen.findByText('Page 2 of 5 · 24 results')).toBeVisible()
    expect(screen.getByText('1 ticket selected')).toBeVisible()
    expect(
      screen.getByText('· 0 on this page, 1 outside this view'),
    ).toBeVisible()

    const search = screen.getByRole('searchbox', { name: 'Search tickets' })
    fireEvent.change(search, { target: { value: 'Billing' } })
    await olderStarted.promise
    expect(
      screen.getByRole('region', { name: 'Ticket results' }),
    ).toHaveAttribute('aria-busy', 'true')

    const newStatus = screen.getByRole('checkbox', { name: 'New' })
    await user.click(newStatus)
    await latestStarted.promise

    await act(async () => {
      latestRequest.resolve(latestPage)
      await latestRequest.promise
    })
    expect(
      await screen.findByRole('table', { name: /showing 2 of 2/ }),
    ).toBeVisible()
    expect(search).toHaveValue('Billing')
    expect(newStatus).toBeChecked()
    expect(
      screen.getByRole('checkbox', { name: selectedTicketName }),
    ).toBeChecked()
    expect(screen.getByText('1 ticket selected')).toBeVisible()

    await act(async () => {
      olderRequest.resolve(olderPage)
      await olderRequest.promise
    })
    expect(screen.getByRole('table')).toHaveAccessibleName(/showing 2 of 2/)
    expect(search).toHaveValue('Billing')
    expect(newStatus).toBeChecked()
    expect(
      screen.getByRole('checkbox', { name: selectedTicketName }),
    ).toBeChecked()
  })

  it('validates an edit, commits optimistic success, and rolls back a later failure', async () => {
    const repository = createTicketRepository({ defaultLatencyMs: 0 })
    const updateTicket = repository.updateTicket.bind(repository)
    const successfulUpdate = createDeferred<void>()
    const failedUpdate = createDeferred<void>()
    let updateCallCount = 0
    const updateSpy = vi
      .spyOn(repository, 'updateTicket')
      .mockImplementation(async (command, options) => {
        updateCallCount += 1
        if (updateCallCount === 1) {
          await successfulUpdate.promise
          return updateTicket(command, options)
        }
        await failedUpdate.promise
        throw new Error('The gated follow-up save failed.')
      })
    const user = userEvent.setup()
    render(<App repository={repository} />)
    await screen.findByRole('table')

    await user.click(
      screen.getByRole('button', {
        name: ticketTriggerName(primaryTicket),
      }),
    )
    const dialog = await screen.findByRole('dialog', {
      name: primaryTicket.title,
    })
    const dialogScope = within(dialog)
    await user.click(dialogScope.getByRole('button', { name: 'Edit ticket' }))

    let title = dialogScope.getByRole('textbox', { name: 'Title' })
    await user.clear(title)
    await user.type(title, 'No')
    await user.click(dialogScope.getByRole('button', { name: 'Save ticket' }))

    const validationSummary = dialogScope.getByRole('alert')
    expect(validationSummary).toHaveFocus()
    expect(validationSummary).toHaveTextContent('Fix 1 error before saving')
    expect(title).toHaveAttribute('aria-invalid', 'true')
    expect(title).toHaveAccessibleDescription(
      /4–120 characters Title must be at least 4 characters/,
    )
    expect(updateSpy).not.toHaveBeenCalled()

    const successfulTitle = 'Integrated annual invoice resolution'
    await user.clear(title)
    await user.type(title, successfulTitle)
    await user.selectOptions(
      dialogScope.getByRole('combobox', { name: 'Status' }),
      'open',
    )
    await user.click(dialogScope.getByRole('button', { name: 'Save ticket' }))

    const optimisticSuccessTrigger = await screen.findByRole('button', {
      name: `Open ${primaryTicket.id} details: ${successfulTitle}`,
    })
    const optimisticSuccessRow = optimisticSuccessTrigger.closest('tr')
    if (!optimisticSuccessRow) throw new Error('Expected an optimistic ticket row.')
    expect(within(optimisticSuccessRow).getByText('Open')).toBeVisible()
    expect(
      screen.getByRole('dialog', { name: successfulTitle }),
    ).toBeVisible()
    expect(
      dialogScope.getByRole('button', { name: 'Saving ticket…' }),
    ).toBeDisabled()

    await act(async () => {
      successfulUpdate.resolve(undefined)
      await successfulUpdate.promise
    })
    expect(
      await dialogScope.findByRole('button', { name: 'Edit ticket' }),
    ).toHaveFocus()
    expect(updateSpy).toHaveBeenCalledTimes(1)
    expect(
      screen.getByTestId('polite-operation-announcements'),
    ).toHaveTextContent(`Saved ${primaryTicket.id}: ${successfulTitle}.`)

    await user.click(dialogScope.getByRole('button', { name: 'Edit ticket' }))
    title = dialogScope.getByRole('textbox', { name: 'Title' })
    const failedTitle = 'Optimistic title that must roll back'
    await user.clear(title)
    await user.type(title, failedTitle)
    await user.click(dialogScope.getByRole('button', { name: 'Save ticket' }))

    expect(
      await screen.findByRole('button', {
        name: `Open ${primaryTicket.id} details: ${failedTitle}`,
      }),
    ).toBeVisible()
    expect(
      dialogScope.getByRole('button', { name: 'Saving ticket…' }),
    ).toBeDisabled()

    await act(async () => {
      failedUpdate.resolve(undefined)
      await failedUpdate.promise
    })
    const saveFailure = await dialogScope.findByRole('heading', {
      name: 'Ticket save failed',
    })
    expect(saveFailure.parentElement).toHaveTextContent(
      'The last saved values were restored in the ticket list',
    )
    expect(dialog).toHaveAccessibleName(successfulTitle)
    expect(title).toHaveValue(failedTitle)
    expect(title).not.toBeDisabled()
    expect(
      dialogScope.getByRole('button', { name: 'Retry save' }),
    ).toBeVisible()
    expect(
      screen.getByRole('button', {
        name: `Open ${primaryTicket.id} details: ${successfulTitle}`,
      }),
    ).toBeVisible()
    expect(
      screen.queryByRole('button', {
        name: `Open ${primaryTicket.id} details: ${failedTitle}`,
      }),
    ).not.toBeInTheDocument()
    expect(
      screen.getByTestId('assertive-operation-announcements'),
    ).toHaveTextContent(
      'Ticket save failed. Last saved values restored; draft retained for retry.',
    )
    expect(updateSpy).toHaveBeenCalledTimes(2)
  })

  it('confirms dirty close and switch intents while restoring useful focus', async () => {
    const user = userEvent.setup()
    render(
      <App repository={createTicketRepository({ defaultLatencyMs: 0 })} />,
    )
    await screen.findByRole('table')

    const firstTrigger = screen.getByRole('button', {
      name: ticketTriggerName(primaryTicket),
    })
    const secondTrigger = screen.getByRole('button', {
      name: ticketTriggerName(secondaryTicket),
    })
    await user.click(firstTrigger)
    let dialog = await screen.findByRole('dialog', {
      name: primaryTicket.title,
    })
    let dialogScope = within(dialog)
    await user.click(dialogScope.getByRole('button', { name: 'Edit ticket' }))
    const title = dialogScope.getByRole('textbox', { name: 'Title' })
    const protectedDraft = 'Protected invoice integration draft'
    await user.clear(title)
    await user.type(title, protectedDraft)

    await user.keyboard('{Escape}')
    let confirmation = screen.getByRole('alertdialog', {
      name: 'Discard unsaved changes?',
    })
    expect(confirmation).toHaveAccessibleDescription(
      'Closing ticket details will discard the edits in this form.',
    )
    const continueEditing = within(confirmation).getByRole('button', {
      name: 'Continue editing',
    })
    expect(continueEditing).toHaveFocus()
    await user.click(continueEditing)

    expect(title).toHaveValue(protectedDraft)
    expect(title).toHaveFocus()

    await user.click(secondTrigger)
    confirmation = screen.getByRole('alertdialog', {
      name: 'Discard unsaved changes?',
    })
    expect(confirmation).toHaveAccessibleDescription(
      'Opening another ticket will discard the edits in this form.',
    )
    await user.click(
      within(confirmation).getByRole('button', { name: 'Discard changes' }),
    )

    dialog = await screen.findByRole('dialog', {
      name: secondaryTicket.title,
    })
    dialogScope = within(dialog)
    const close = dialogScope.getByRole('button', { name: 'Close details' })
    expect(dialogScope.queryByRole('textbox', { name: 'Title' })).not.toBeInTheDocument()
    expect(close).toHaveFocus()
    await user.click(close)

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(secondTrigger).toHaveFocus()
  })
})
