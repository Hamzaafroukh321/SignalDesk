import { useEffect, useRef } from 'react'
import type { Ticket, TicketId } from '../../domain/ticket'
import type {
  SortDirection,
  TicketSortField,
} from '../../data/ticketRepository'
import { TicketRow } from './TicketRow'

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
            <TicketRow
              key={ticket.id}
              ticket={ticket}
              selected={selectedIds.has(ticket.id)}
              selectionDisabled={selectionDisabled}
              onSelectionChange={onSelectionChange}
              onOpenTicket={onOpenTicket}
            />
          ))}
        </tbody>
      </table>
    </div>
  )
}
