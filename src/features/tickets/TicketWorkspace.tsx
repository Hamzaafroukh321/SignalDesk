import { useEffect, useRef, useState } from 'react'
import type { Ticket, TicketId } from '../../domain/ticket'
import {
  isAbortError,
  type TicketRepository,
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
  const resultsHeadingRef = useRef<HTMLHeadingElement>(null)
  const focusResultsAfterRetryRef = useRef(false)

  useEffect(() => {
    const controller = new AbortController()

    void repository
      .listTickets({}, { signal: controller.signal })
      .then((page) => {
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
        if (!isAbortError(error)) {
          setList((current) => ({
            status: 'error',
            previous: getSnapshot(current),
          }))
        }
      })

    return () => {
      controller.abort()
    }
  }, [repository, requestVersion])

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

  const retry = () => {
    focusResultsAfterRetryRef.current = true
    setList((current) => ({
      status: 'loading',
      previous: getSnapshot(current),
    }))
    setRequestVersion((version) => version + 1)
  }

  return (
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
          <span className="result-count">{visibleSnapshot.totalCount} tickets</span>
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
        />
      ) : null}

      {list.status === 'success' && list.snapshot.totalCount === 0 ? (
        <div className="result-state empty-state">
          <span className="empty-mark" aria-hidden="true">
            0
          </span>
          <div>
            <h3>No tickets in this queue</h3>
            <p>The current ticket view is valid, but it has no matching work.</p>
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
          {list.status === 'loading' ? 'Loading the ticket queue…' : null}
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
  )
}
