import { useEffect, useRef, useState } from 'react'
import {
  getPriorityLabel,
  getStatusLabel,
  ticketPriorities,
  ticketStatuses,
  type Ticket,
  type TicketId,
  type TicketPriority,
  type TicketStatus,
} from '../../domain/ticket'
import {
  isAbortError,
  TicketVersionConflictError,
  type TicketChanges,
  type TicketRepository,
  type TicketSortField,
} from '../../data/ticketRepository'
import {
  parseTicketListState,
  serializeTicketListState,
  writeTicketListUrl,
  type TicketListState,
} from './listState'
import { TicketTable } from './TicketTable'
import {
  TicketDetailsDialog,
  type TicketDetailResource,
} from './TicketDetailsDialog'

interface TicketWorkspaceProps {
  repository: TicketRepository
}

interface TicketListSnapshot {
  ids: TicketId[]
  entities: ReadonlyMap<TicketId, Ticket>
  totalCount: number
  page: number
  totalPages: number
  pageSize: number
}

type ListResource =
  | { status: 'loading'; previous: TicketListSnapshot | null }
  | { status: 'success'; snapshot: TicketListSnapshot }
  | { status: 'error'; previous: TicketListSnapshot | null }

type BulkUpdateState =
  | { status: 'idle' }
  | { status: 'pending'; count: number }
  | { status: 'success'; message: string }
  | { status: 'error'; message: string }

interface OptimisticSave {
  operationId: number
  ticket: Ticket
}

function getSnapshot(list: ListResource): TicketListSnapshot | null {
  if (list.status === 'success') return list.snapshot
  return list.previous
}

function applyTicketChanges(ticket: Ticket, changes: TicketChanges): Ticket {
  return {
    ...ticket,
    ...changes,
    assignee: Object.hasOwn(changes, 'assignee')
      ? (changes.assignee ?? null)
      : ticket.assignee,
    tags: changes.tags ?? ticket.tags,
  }
}

export function TicketWorkspace({ repository }: TicketWorkspaceProps) {
  const [list, setList] = useState<ListResource>({
    status: 'loading',
    previous: null,
  })
  const [requestVersion, setRequestVersion] = useState(0)
  const [selectedIds, setSelectedIds] = useState<Set<TicketId>>(() => new Set())
  const [bulkStatus, setBulkStatus] = useState<TicketStatus>('pending')
  const [bulkUpdate, setBulkUpdate] = useState<BulkUpdateState>({ status: 'idle' })
  const [activeTicketId, setActiveTicketId] = useState<TicketId | null>(null)
  const [detail, setDetail] = useState<TicketDetailResource | null>(null)
  const [optimisticSaves, setOptimisticSaves] = useState<
    ReadonlyMap<TicketId, OptimisticSave>
  >(() => new Map())
  const [detailRequestVersion, setDetailRequestVersion] = useState(0)
  const [listState, setListState] = useState(() =>
    parseTicketListState(window.location.search),
  )
  const listStateRef = useRef(listState)
  const {
    search,
    statuses,
    priorities,
    sortBy,
    sortDirection,
    page: currentPage,
    pageSize,
  } = listState
  const resultsHeadingRef = useRef<HTMLHeadingElement>(null)
  const focusResultsAfterRetryRef = useRef(false)
  const latestRequestRef = useRef(0)
  const latestDetailRequestRef = useRef(0)
  const saveOperationSequenceRef = useRef(0)
  const latestSaveByTicketRef = useRef<Map<TicketId, number>>(new Map())
  const dialogTriggerRef = useRef<{
    id: TicketId
    element: HTMLButtonElement
  } | null>(null)
  const pendingFocusRestoreRef = useRef(false)

  useEffect(() => {
    const controller = new AbortController()
    const requestId = latestRequestRef.current + 1
    latestRequestRef.current = requestId

    void repository
      .listTickets(
        {
          search,
          statuses,
          priorities,
          sortBy,
          sortDirection,
          page: currentPage,
          pageSize,
        },
        { signal: controller.signal },
      )
      .then((page) => {
        if (requestId !== latestRequestRef.current) return
        setList((current) => {
          const entities = new Map(getSnapshot(current)?.entities ?? [])
          page.tickets.forEach((ticket) => entities.set(ticket.id, ticket))
          return {
            status: 'success',
            snapshot: {
              ids: page.tickets.map((ticket) => ticket.id),
              entities,
              totalCount: page.totalCount,
              page: page.page,
              totalPages: page.totalPages,
              pageSize: page.pageSize,
            },
          }
        })
        if (page.page !== currentPage) {
          const correctedState = {
            ...listStateRef.current,
            page: page.page,
          }
          listStateRef.current = correctedState
          setListState(correctedState)
          writeTicketListUrl(correctedState, 'replace')
        }
      })
      .catch((error: unknown) => {
        if (
          requestId === latestRequestRef.current &&
          !isAbortError(error)
        ) {
          setList((current) => ({
            status: 'error',
            previous: getSnapshot(current),
          }))
        }
      })

    return () => {
      if (latestRequestRef.current === requestId) {
        latestRequestRef.current += 1
      }
      controller.abort()
    }
  }, [
    currentPage,
    pageSize,
    priorities,
    repository,
    requestVersion,
    search,
    sortBy,
    sortDirection,
    statuses,
  ])

  useEffect(() => {
    const currentUrl = `${window.location.pathname}${window.location.search}${window.location.hash}`
    const expectedUrl = `${window.location.pathname}${
      serializeTicketListState(listStateRef.current)
    }${window.location.hash}`

    if (currentUrl !== expectedUrl) {
      window.history.replaceState(null, '', expectedUrl)
    }
  }, [])

  useEffect(() => {
    const handlePopState = () => {
      const restoredState = parseTicketListState(window.location.search)
      listStateRef.current = restoredState
      writeTicketListUrl(restoredState, 'replace')
      setList((current) => ({
        status: 'loading',
        previous: getSnapshot(current),
      }))
      setListState(restoredState)
    }

    window.addEventListener('popstate', handlePopState)
    return () => window.removeEventListener('popstate', handlePopState)
  }, [])

  useEffect(() => {
    if (list.status === 'success' && focusResultsAfterRetryRef.current) {
      focusResultsAfterRetryRef.current = false
      resultsHeadingRef.current?.focus()
    }
  }, [list.status])

  useEffect(() => {
    if (!activeTicketId) return

    const controller = new AbortController()
    const requestId = latestDetailRequestRef.current + 1
    latestDetailRequestRef.current = requestId
    const ticketId = activeTicketId

    void repository
      .getTicket(ticketId, { signal: controller.signal })
      .then((ticket) => {
        if (requestId === latestDetailRequestRef.current) {
          setDetail({ status: 'success', ticket })
        }
      })
      .catch((error: unknown) => {
        if (
          requestId === latestDetailRequestRef.current &&
          !isAbortError(error)
        ) {
          setDetail({ status: 'error', ticketId })
        }
      })

    return () => {
      if (latestDetailRequestRef.current === requestId) {
        latestDetailRequestRef.current += 1
      }
      controller.abort()
    }
  }, [activeTicketId, detailRequestVersion, repository])

  useEffect(() => {
    if (detail || !pendingFocusRestoreRef.current) return

    pendingFocusRestoreRef.current = false
    const trigger = dialogTriggerRef.current
    if (trigger?.element.isConnected) {
      trigger.element.focus()
      return
    }

    const replacement = trigger
      ? document.querySelector<HTMLButtonElement>(
          `[data-ticket-detail-trigger="${trigger.id}"]`,
        )
      : null
    const focusTarget = replacement ?? resultsHeadingRef.current
    focusTarget?.focus()
  }, [detail])

  const visibleSnapshot = getSnapshot(list)

  const tickets = visibleSnapshot
    ? visibleSnapshot.ids.flatMap((id) => {
        const ticket = visibleSnapshot.entities.get(id)
        if (!ticket) return []
        return [optimisticSaves.get(id)?.ticket ?? ticket]
      })
    : []

  const visibleDetail: TicketDetailResource | null =
    detail?.status === 'success' && optimisticSaves.has(detail.ticket.id)
      ? {
          status: 'success',
          ticket: optimisticSaves.get(detail.ticket.id)?.ticket ?? detail.ticket,
        }
      : detail

  const markResultsUpdating = () => {
    setList((current) => ({
      status: 'loading',
      previous: getSnapshot(current),
    }))
  }

  const retry = () => {
    focusResultsAfterRetryRef.current = true
    markResultsUpdating()
    setRequestVersion((version) => version + 1)
  }

  const applyListState = (
    nextState: TicketListState,
    historyMode: 'push' | 'replace',
  ) => {
    markResultsUpdating()
    listStateRef.current = nextState
    setListState(nextState)
    writeTicketListUrl(nextState, historyMode)
  }

  const beginSearch = (value: string) => {
    applyListState(
      { ...listStateRef.current, search: value, page: 1 },
      'replace',
    )
  }

  const setStatusFilter = (status: TicketStatus, checked: boolean) => {
    const current = listStateRef.current
    const nextStatuses = ticketStatuses.filter((candidate) =>
      candidate === status ? checked : current.statuses.includes(candidate),
    )
    applyListState(
      { ...current, statuses: nextStatuses, page: 1 },
      'push',
    )
  }

  const setPriorityFilter = (
    priority: TicketPriority,
    checked: boolean,
  ) => {
    const current = listStateRef.current
    const nextPriorities = ticketPriorities.filter((candidate) =>
      candidate === priority ? checked : current.priorities.includes(candidate),
    )
    applyListState(
      { ...current, priorities: nextPriorities, page: 1 },
      'push',
    )
  }

  const clearFilters = () => {
    applyListState(
      { ...listStateRef.current, statuses: [], priorities: [], page: 1 },
      'push',
    )
  }

  const sortTickets = (field: TicketSortField) => {
    const current = listStateRef.current
    applyListState(
      {
        ...current,
        sortBy: field,
        sortDirection:
          field === current.sortBy
            ? current.sortDirection === 'asc'
              ? 'desc'
              : 'asc'
            : 'asc',
        page: 1,
      },
      'push',
    )
  }

  const activeFilterCount = statuses.length + priorities.length
  const hasListRefinement = Boolean(search || activeFilterCount)
  const sortLabel: Record<TicketSortField, string> = {
    title: 'Ticket title',
    status: 'Status',
    priority: 'Priority',
    updatedAt: 'Updated time',
  }

  const goToPage = (page: number) => {
    applyListState({ ...listStateRef.current, page }, 'push')
  }

  const setTicketSelected = (id: TicketId, checked: boolean) => {
    setSelectedIds((current) => {
      const next = new Set(current)
      if (checked) next.add(id)
      else next.delete(id)
      return next
    })
  }

  const clearSelection = () => setSelectedIds(new Set())
  const visibleSelectedCount = tickets.filter((ticket) =>
    selectedIds.has(ticket.id),
  ).length
  const hiddenSelectedCount = selectedIds.size - visibleSelectedCount

  const toggleVisibleTickets = (checked: boolean) => {
    setSelectedIds((current) => {
      const next = new Set(current)
      tickets.forEach((ticket) => {
        if (checked) next.add(ticket.id)
        else next.delete(ticket.id)
      })
      return next
    })
  }

  const applyBulkStatus = async () => {
    const snapshot = getSnapshot(list)
    if (!snapshot || !selectedIds.size || bulkUpdate.status === 'pending') return

    const selectedTickets = [...selectedIds].map((id) => snapshot.entities.get(id))
    if (selectedTickets.some((ticket) => !ticket)) {
      setBulkUpdate({
        status: 'error',
        message:
          'The selected tickets are no longer available. Refresh the queue and try again.',
      })
      return
    }

    const availableTickets = selectedTickets.filter(
      (ticket): ticket is Ticket => ticket !== undefined,
    )
    const count = availableTickets.length
    setBulkUpdate({ status: 'pending', count })
    try {
      const result = await repository.bulkUpdateStatus({
        status: bulkStatus,
        targets: availableTickets.map((ticket) => ({
          id: ticket.id,
          expectedVersion: ticket.version,
        })),
      })

      setList((current) => {
        const currentSnapshot = getSnapshot(current)
        if (!currentSnapshot) return current
        const entities = new Map(currentSnapshot.entities)
        result.tickets.forEach((ticket) => entities.set(ticket.id, ticket))
        return {
          status: 'loading',
          previous: { ...currentSnapshot, entities },
        }
      })
      setSelectedIds(new Set())
      setBulkUpdate({
        status: 'success',
        message: `Applied ${getStatusLabel(bulkStatus)} to ${count} ${
          count === 1 ? 'ticket' : 'tickets'
        }. Selection cleared.`,
      })
      setRequestVersion((version) => version + 1)
    } catch {
      setBulkUpdate({
        status: 'error',
        message: `Bulk update failed. Your ${count} selected ${
          count === 1 ? 'ticket remains' : 'tickets remain'
        } selected. Try again.`,
      })
    }
  }

  const bulkPending = bulkUpdate.status === 'pending'

  const openTicket = (id: TicketId, trigger: HTMLButtonElement) => {
    dialogTriggerRef.current = { id, element: trigger }
    setActiveTicketId(id)
    setDetail({ status: 'loading', ticketId: id })
  }

  const closeTicket = () => {
    pendingFocusRestoreRef.current = true
    setActiveTicketId(null)
    setDetail(null)
  }

  const retryTicket = () => {
    if (!activeTicketId) return
    setDetail({ status: 'loading', ticketId: activeTicketId })
    setDetailRequestVersion((version) => version + 1)
  }

  const saveActiveTicket = async (changes: TicketChanges) => {
    if (detail?.status !== 'success') return
    const baseline = detail.ticket
    const operationId = saveOperationSequenceRef.current + 1
    saveOperationSequenceRef.current = operationId
    latestSaveByTicketRef.current.set(baseline.id, operationId)
    setOptimisticSaves((current) => {
      const next = new Map(current)
      next.set(baseline.id, {
        operationId,
        ticket: applyTicketChanges(baseline, changes),
      })
      return next
    })

    const reconcileAuthoritativeTicket = (ticket: Ticket) => {
      setDetail((current) => {
        if (!current) return current
        const currentId =
          current.status === 'success' ? current.ticket.id : current.ticketId
        if (currentId !== ticket.id) return current
        if (
          current.status === 'success' &&
          current.ticket.version > ticket.version
        ) {
          return current
        }
        return { status: 'success', ticket }
      })
      setList((current) => {
        const snapshot = getSnapshot(current)
        if (!snapshot) return current
        const entities = new Map(snapshot.entities)
        const existing = entities.get(ticket.id)
        if (!existing || existing.version <= ticket.version) {
          entities.set(ticket.id, ticket)
        }
        return {
          status: 'loading',
          previous: { ...snapshot, entities },
        }
      })
      setRequestVersion((version) => version + 1)
    }

    try {
      const saved = await repository.updateTicket({
        id: baseline.id,
        expectedVersion: baseline.version,
        changes,
      })
      reconcileAuthoritativeTicket(saved)
    } catch (error) {
      if (error instanceof TicketVersionConflictError) {
        reconcileAuthoritativeTicket(error.currentTicket)
      }
      throw error
    } finally {
      setOptimisticSaves((current) => {
        if (current.get(baseline.id)?.operationId !== operationId) return current
        const next = new Map(current)
        next.delete(baseline.id)
        return next
      })
      if (latestSaveByTicketRef.current.get(baseline.id) === operationId) {
        latestSaveByTicketRef.current.delete(baseline.id)
      }
    }
  }

  return (
    <>
      <section className="panel controls-panel" aria-labelledby="controls-title">
        <div>
          <p className="panel-kicker">Refine the queue</p>
          <h2 id="controls-title">Ticket controls</h2>
        </div>

        <div className="search-control">
          <label htmlFor="ticket-search">Search tickets</label>
          <p id="ticket-search-hint">
            Find a title, customer, ticket ID, or tag.
          </p>
          <div className="search-input-row">
            <input
              id="ticket-search"
              type="search"
              value={search}
              aria-describedby="ticket-search-hint"
              onChange={(event) => beginSearch(event.currentTarget.value)}
            />
            {search ? (
              <button
                className="clear-button"
                type="button"
                onClick={() => beginSearch('')}
              >
                Clear search
              </button>
            ) : null}
          </div>
        </div>

        <div className="filter-groups">
          <fieldset>
            <legend>Status</legend>
            {ticketStatuses.map((status) => (
              <label key={status} className="filter-option">
                <input
                  type="checkbox"
                  checked={statuses.includes(status)}
                  onChange={(event) =>
                    setStatusFilter(status, event.currentTarget.checked)
                  }
                />
                <span>{getStatusLabel(status)}</span>
              </label>
            ))}
          </fieldset>

          <fieldset>
            <legend>Priority</legend>
            {ticketPriorities.map((priority) => (
              <label key={priority} className="filter-option">
                <input
                  type="checkbox"
                  checked={priorities.includes(priority)}
                  onChange={(event) =>
                    setPriorityFilter(priority, event.currentTarget.checked)
                  }
                />
                <span>{getPriorityLabel(priority)}</span>
              </label>
            ))}
          </fieldset>
        </div>

        <div className="filter-summary" aria-live="polite">
          <p>
            {activeFilterCount
              ? `${activeFilterCount} active ${activeFilterCount === 1 ? 'filter' : 'filters'}: ${[
                  statuses.length
                    ? `Status ${statuses.map(getStatusLabel).join(', ')}`
                    : '',
                  priorities.length
                    ? `Priority ${priorities.map(getPriorityLabel).join(', ')}`
                    : '',
                ]
                  .filter(Boolean)
                  .join('; ')}.`
              : 'No status or priority filters are active.'}
          </p>
          {activeFilterCount ? (
            <button className="clear-button" type="button" onClick={clearFilters}>
              Clear all filters
            </button>
          ) : null}
        </div>
      </section>

      <section
        className="panel results-panel"
        aria-labelledby="results-title"
        aria-busy={list.status === 'loading'}
      >
      <div className="panel-heading">
        <div>
          <p className="panel-kicker">Shared focus</p>
          <h2 id="results-title" ref={resultsHeadingRef} tabIndex={-1}>
            Ticket results
          </h2>
        </div>
        {visibleSnapshot ? (
          <div className="result-meta">
            <span className="result-count">{visibleSnapshot.totalCount} tickets</span>
            <span className="sort-summary">
              Sorted by {sortLabel[sortBy]} ·{' '}
              {sortDirection === 'asc' ? 'Ascending' : 'Descending'}
            </span>
          </div>
        ) : null}
      </div>

      {list.status === 'loading' && !visibleSnapshot ? (
        <div className="result-state loading-state">
          <span className="loading-mark" aria-hidden="true" />
          <div>
            <h3>Gathering the queue</h3>
            <p>SignalDesk is loading the latest ticket view.</p>
          </div>
        </div>
      ) : null}

      {visibleSnapshot ? (
        <>
          <div className="selection-summary">
            <p id="selection-scope">
              <span>
                {selectedIds.size}{' '}
                {selectedIds.size === 1 ? 'ticket' : 'tickets'} selected
              </span>
              <span className="selection-scope-detail">
                {' '}
                · {visibleSelectedCount} on this page
                {hiddenSelectedCount
                  ? `, ${hiddenSelectedCount} outside this view`
                  : ''}
              </span>
            </p>
            {selectedIds.size ? (
              <button
                className="clear-button"
                type="button"
                disabled={bulkPending}
                onClick={clearSelection}
              >
                Clear selection
              </button>
            ) : null}
          </div>
          <div className="bulk-actions" aria-labelledby="bulk-actions-title">
            <div>
              <h3 id="bulk-actions-title">Bulk status update</h3>
              <p>Selection clears after a successful bulk update.</p>
            </div>
            <div className="bulk-action-controls">
              <label htmlFor="bulk-status">New status for selected tickets</label>
              <select
                id="bulk-status"
                value={bulkStatus}
                disabled={bulkPending}
                onChange={(event) =>
                  setBulkStatus(event.currentTarget.value as TicketStatus)
                }
              >
                {ticketStatuses.map((status) => (
                  <option key={status} value={status}>
                    {getStatusLabel(status)}
                  </option>
                ))}
              </select>
              <button
                className="primary-button"
                type="button"
                disabled={!selectedIds.size || bulkPending}
                onClick={() => void applyBulkStatus()}
              >
                {bulkPending ? 'Applying status…' : 'Apply status'}
              </button>
            </div>
            {bulkUpdate.status === 'pending' ? (
              <p className="bulk-feedback" role="status">
                Updating {bulkUpdate.count}{' '}
                {bulkUpdate.count === 1 ? 'ticket' : 'tickets'}…
              </p>
            ) : null}
            {bulkUpdate.status === 'success' ? (
              <p className="bulk-feedback success-feedback" role="status">
                {bulkUpdate.message}
              </p>
            ) : null}
            {bulkUpdate.status === 'error' ? (
              <p className="bulk-feedback error-feedback" role="alert">
                {bulkUpdate.message}
              </p>
            ) : null}
          </div>
          {visibleSnapshot.totalCount > 0 ? (
            <TicketTable
              tickets={tickets}
              totalCount={visibleSnapshot.totalCount}
              sortBy={sortBy}
              sortDirection={sortDirection}
              onSort={sortTickets}
              selectedIds={selectedIds}
              onSelectionChange={setTicketSelected}
              onToggleVisible={toggleVisibleTickets}
              selectionDisabled={bulkPending}
              onOpenTicket={openTicket}
            />
          ) : null}
        </>
      ) : null}

      {list.status === 'success' && list.snapshot.totalCount === 0 ? (
        <div className="result-state empty-state">
          <span className="empty-mark" aria-hidden="true">
            0
          </span>
          <div>
            <h3>
              {hasListRefinement
                ? 'No tickets match this view'
                : 'No tickets in this queue'}
            </h3>
            <p>
              {hasListRefinement
                ? 'Try changing the search or clearing the active filters.'
                : 'The current ticket view is valid, but it has no matching work.'}
            </p>
          </div>
        </div>
      ) : null}

      {list.status === 'error' ? (
        <div className="result-state error-state" role="alert">
          <span className="error-mark" aria-hidden="true">
            !
          </span>
          <div>
            <h3>Ticket results are unavailable</h3>
            <p>The queue could not be loaded. Your workspace is still here.</p>
            <button className="secondary-button" type="button" onClick={retry}>
              Retry loading tickets
            </button>
          </div>
        </div>
      ) : null}

      {visibleSnapshot ? (
        <nav className="pagination" aria-label="Ticket result pages">
          <p>
            Page {visibleSnapshot.page} of {visibleSnapshot.totalPages} ·{' '}
            {visibleSnapshot.totalCount}{' '}
            {visibleSnapshot.totalCount === 1 ? 'result' : 'results'}
          </p>
          <div className="pagination-actions">
            <button
              type="button"
              className="secondary-button"
              disabled={
                list.status === 'loading' || visibleSnapshot.page <= 1
              }
              onClick={() => goToPage(visibleSnapshot.page - 1)}
            >
              Previous page
            </button>
            <button
              type="button"
              className="secondary-button"
              disabled={
                list.status === 'loading' ||
                visibleSnapshot.page >= visibleSnapshot.totalPages
              }
              onClick={() => goToPage(visibleSnapshot.page + 1)}
            >
              Next page
            </button>
          </div>
        </nav>
      ) : null}

      <div className="status-area">
        <p role="status" aria-live="polite" aria-atomic="true">
          {list.status === 'loading'
            ? hasListRefinement
              ? 'Updating the refined ticket results…'
              : 'Loading the ticket queue…'
            : null}
          {list.status === 'success' && list.snapshot.totalCount > 0
            ? `${tickets.length} tickets are ready for review.`
            : null}
          {list.status === 'success' && list.snapshot.totalCount === 0
            ? 'No tickets match the current queue view.'
            : null}
          {list.status === 'error'
            ? 'The ticket queue could not be loaded. Retry is available.'
            : null}
        </p>
      </div>
      </section>
      {visibleDetail ? (
        <TicketDetailsDialog
          detail={visibleDetail}
          onClose={closeTicket}
          onRetry={retryTicket}
          onSave={saveActiveTicket}
        />
      ) : null}
    </>
  )
}
