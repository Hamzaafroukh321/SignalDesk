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
  type SortDirection,
  type TicketRepository,
  type TicketSortField,
} from '../../data/ticketRepository'
import { TicketTable } from './TicketTable'

interface TicketWorkspaceProps {
  repository: TicketRepository
}

interface TicketListSnapshot {
  ids: TicketId[]
  entities: ReadonlyMap<TicketId, Ticket>
  totalCount: number
}

type ListResource =
  | { status: 'loading'; previous: TicketListSnapshot | null }
  | { status: 'success'; snapshot: TicketListSnapshot }
  | { status: 'error'; previous: TicketListSnapshot | null }

function getSnapshot(list: ListResource): TicketListSnapshot | null {
  if (list.status === 'success') return list.snapshot
  return list.previous
}

export function TicketWorkspace({ repository }: TicketWorkspaceProps) {
  const [list, setList] = useState<ListResource>({
    status: 'loading',
    previous: null,
  })
  const [requestVersion, setRequestVersion] = useState(0)
  const [search, setSearch] = useState('')
  const [statuses, setStatuses] = useState<TicketStatus[]>([])
  const [priorities, setPriorities] = useState<TicketPriority[]>([])
  const [sortBy, setSortBy] = useState<TicketSortField>('updatedAt')
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc')
  const resultsHeadingRef = useRef<HTMLHeadingElement>(null)
  const focusResultsAfterRetryRef = useRef(false)
  const latestRequestRef = useRef(0)

  useEffect(() => {
    const controller = new AbortController()
    const requestId = latestRequestRef.current + 1
    latestRequestRef.current = requestId

    void repository
      .listTickets(
        { search, statuses, priorities, sortBy, sortDirection },
        { signal: controller.signal },
      )
      .then((page) => {
        if (requestId !== latestRequestRef.current) return
        setList({
          status: 'success',
          snapshot: {
            ids: page.tickets.map((ticket) => ticket.id),
            entities: new Map(
              page.tickets.map((ticket) => [ticket.id, ticket] as const),
            ),
            totalCount: page.totalCount,
          },
        })
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
    priorities,
    repository,
    requestVersion,
    search,
    sortBy,
    sortDirection,
    statuses,
  ])

  useEffect(() => {
    if (list.status === 'success' && focusResultsAfterRetryRef.current) {
      focusResultsAfterRetryRef.current = false
      resultsHeadingRef.current?.focus()
    }
  }, [list.status])

  const visibleSnapshot = getSnapshot(list)

  const tickets =
    visibleSnapshot
      ? visibleSnapshot.ids.flatMap((id) => {
          const ticket = visibleSnapshot.entities.get(id)
          return ticket ? [ticket] : []
        })
      : []

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

  const beginSearch = (value: string) => {
    markResultsUpdating()
    setSearch(value)
  }

  const setStatusFilter = (status: TicketStatus, checked: boolean) => {
    markResultsUpdating()
    setStatuses((current) =>
      ticketStatuses.filter((candidate) =>
        candidate === status ? checked : current.includes(candidate),
      ),
    )
  }

  const setPriorityFilter = (
    priority: TicketPriority,
    checked: boolean,
  ) => {
    markResultsUpdating()
    setPriorities((current) =>
      ticketPriorities.filter((candidate) =>
        candidate === priority ? checked : current.includes(candidate),
      ),
    )
  }

  const clearFilters = () => {
    markResultsUpdating()
    setStatuses([])
    setPriorities([])
  }

  const sortTickets = (field: TicketSortField) => {
    markResultsUpdating()
    if (field === sortBy) {
      setSortDirection((direction) => (direction === 'asc' ? 'desc' : 'asc'))
      return
    }
    setSortBy(field)
    setSortDirection('asc')
  }

  const activeFilterCount = statuses.length + priorities.length
  const hasListRefinement = Boolean(search || activeFilterCount)
  const sortLabel: Record<TicketSortField, string> = {
    title: 'Ticket title',
    status: 'Status',
    priority: 'Priority',
    updatedAt: 'Updated time',
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

      {visibleSnapshot && visibleSnapshot.totalCount > 0 ? (
        <TicketTable
          tickets={tickets}
          totalCount={visibleSnapshot.totalCount}
          sortBy={sortBy}
          sortDirection={sortDirection}
          onSort={sortTickets}
        />
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
    </>
  )
}
