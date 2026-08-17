import { useEffect, useState } from 'react'
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
  | { status: 'loading' }
  | { status: 'success'; snapshot: TicketListSnapshot }
  | { status: 'error' }

export function TicketWorkspace({ repository }: TicketWorkspaceProps) {
  const [list, setList] = useState<ListResource>({ status: 'loading' })

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
        if (!isAbortError(error)) setList({ status: 'error' })
      })

    return () => {
      controller.abort()
    }
  }, [repository])

  const tickets =
    list.status === 'success'
      ? list.snapshot.ids.flatMap((id) => {
          const ticket = list.snapshot.entities.get(id)
          return ticket ? [ticket] : []
        })
      : []

  return (
    <section className="panel results-panel" aria-labelledby="results-title">
      <div className="panel-heading">
        <div>
          <p className="panel-kicker">Shared focus</p>
          <h2 id="results-title">Ticket results</h2>
        </div>
        {list.status === 'success' ? (
          <span className="result-count">{list.snapshot.totalCount} tickets</span>
        ) : null}
      </div>

      {list.status === 'success' ? (
        <TicketTable
          tickets={tickets}
          totalCount={list.snapshot.totalCount}
        />
      ) : null}

      <div className="status-area">
        <p role="status" aria-live="polite" aria-atomic="true">
          {list.status === 'loading' ? 'Loading the ticket queue…' : null}
          {list.status === 'success'
            ? `${tickets.length} tickets are ready for review.`
            : null}
          {list.status === 'error' ? 'The ticket queue could not be loaded.' : null}
        </p>
      </div>
    </section>
  )
}
