import { useEffect, useRef } from 'react'
import {
  getPriorityLabel,
  getStatusLabel,
  type Ticket,
  type TicketId,
} from '../../domain/ticket'
import type {
  SortDirection,
  TicketSortField,
} from '../../data/ticketRepository'

interface TicketTableProps {
  tickets: readonly Ticket[]
  totalCount: number
  sortBy: TicketSortField
  sortDirection: SortDirection
  onSort: (field: TicketSortField) => void
  selectedIds: ReadonlySet<TicketId>
  onSelectionChange: (id: TicketId, checked: boolean) => void
  onToggleVisible: (checked: boolean) => void
  selectionDisabled: boolean
  onOpenTicket: (id: TicketId, trigger: HTMLButtonElement) => void
}

const dateFormatter = new Intl.DateTimeFormat('en', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
  timeZone: 'UTC',
})

interface SortableHeaderProps {
  field: TicketSortField
  label: string
  activeField: TicketSortField
  direction: SortDirection
  onSort: (field: TicketSortField) => void
}

function SortableHeader({
  field,
  label,
  activeField,
  direction,
  onSort,
}: SortableHeaderProps) {
  const active = activeField === field

  return (
    <th
      scope="col"
      className={`sort-column sort-column-${field}`}
      aria-sort={active ? (direction === 'asc' ? 'ascending' : 'descending') : 'none'}
    >
      <button type="button" className="sort-button" onClick={() => onSort(field)}>
        <span>{label}</span>
        <span className="sort-icon" aria-hidden="true">
          {active ? (direction === 'asc' ? '↑' : '↓') : '↕'}
        </span>
      </button>
    </th>
  )
}

export function TicketTable({
  tickets,
  totalCount,
  sortBy,
  sortDirection,
  onSort,
  selectedIds,
  onSelectionChange,
  onToggleVisible,
  selectionDisabled,
  onOpenTicket,
}: TicketTableProps) {
  const selectVisibleRef = useRef<HTMLInputElement>(null)
  const visibleSelectedCount = tickets.filter((ticket) =>
    selectedIds.has(ticket.id),
  ).length
  const allVisibleSelected =
    tickets.length > 0 && visibleSelectedCount === tickets.length
  const someVisibleSelected =
    visibleSelectedCount > 0 && !allVisibleSelected

  useEffect(() => {
    if (selectVisibleRef.current) {
      selectVisibleRef.current.indeterminate = someVisibleSelected
    }
  }, [someVisibleSelected])

  return (
    <div className="table-scroll">
      <table className="ticket-table">
        <caption>
          Current ticket queue — showing {tickets.length} of {totalCount}
        </caption>
        <thead>
          <tr>
            <th scope="col" className="selection-column">
              <input
                ref={selectVisibleRef}
                type="checkbox"
                checked={allVisibleSelected}
                disabled={selectionDisabled}
                aria-label="Select all visible tickets"
                aria-describedby="selection-scope"
                onChange={(event) => onToggleVisible(event.currentTarget.checked)}
              />
              <span className="select-page-label" aria-hidden="true">
                Select page
              </span>
            </th>
            <SortableHeader
              field="title"
              label="Ticket"
              activeField={sortBy}
              direction={sortDirection}
              onSort={onSort}
            />
            <th scope="col" className="static-column-heading">
              Customer
            </th>
            <SortableHeader
              field="status"
              label="Status"
              activeField={sortBy}
              direction={sortDirection}
              onSort={onSort}
            />
            <SortableHeader
              field="priority"
              label="Priority"
              activeField={sortBy}
              direction={sortDirection}
              onSort={onSort}
            />
            <th scope="col" className="static-column-heading">
              Assignee
            </th>
            <SortableHeader
              field="updatedAt"
              label="Updated"
              activeField={sortBy}
              direction={sortDirection}
              onSort={onSort}
            />
          </tr>
        </thead>
        <tbody>
          {tickets.map((ticket) => (
            <tr key={ticket.id}>
              <td className="selection-column">
                <input
                  type="checkbox"
                  checked={selectedIds.has(ticket.id)}
                  disabled={selectionDisabled}
                  aria-label={`Select ${ticket.id}: ${ticket.title}`}
                  onChange={(event) =>
                    onSelectionChange(ticket.id, event.currentTarget.checked)
                  }
                />
              </td>
              <th scope="row" className="ticket-summary-cell">
                <span className="ticket-id">{ticket.id}</span>
                <button
                  type="button"
                  className="ticket-title-button"
                  data-ticket-detail-trigger={ticket.id}
                  aria-label={`Open ${ticket.id} details: ${ticket.title}`}
                  onClick={(event) =>
                    onOpenTicket(ticket.id, event.currentTarget)
                  }
                >
                  {ticket.title}
                </button>
              </th>
              <td className="ticket-data-cell customer-cell">
                <span className="mobile-cell-label" aria-hidden="true">
                  Customer
                </span>
                <span>{ticket.customer.name}</span>
              </td>
              <td className="ticket-data-cell status-cell">
                <span className="mobile-cell-label" aria-hidden="true">
                  Status
                </span>
                <span className={`badge status-${ticket.status}`}>
                  {getStatusLabel(ticket.status)}
                </span>
              </td>
              <td className="ticket-data-cell priority-cell">
                <span className="mobile-cell-label" aria-hidden="true">
                  Priority
                </span>
                <span className={`badge priority-${ticket.priority}`}>
                  {getPriorityLabel(ticket.priority)}
                </span>
              </td>
              <td className="ticket-data-cell assignee-cell">
                <span className="mobile-cell-label" aria-hidden="true">
                  Assignee
                </span>
                <span>{ticket.assignee?.name ?? 'Unassigned'}</span>
              </td>
              <td className="ticket-data-cell updated-cell">
                <span className="mobile-cell-label" aria-hidden="true">
                  Updated
                </span>
                <time dateTime={ticket.updatedAt}>
                  {dateFormatter.format(new Date(ticket.updatedAt))}
                </time>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
