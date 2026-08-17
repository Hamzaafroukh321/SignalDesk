import { getPriorityLabel, getStatusLabel, type Ticket } from '../../domain/ticket'
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
}: TicketTableProps) {
  return (
    <div className="table-scroll">
      <table className="ticket-table">
        <caption>
          Current ticket queue — showing {tickets.length} of {totalCount}
        </caption>
        <thead>
          <tr>
            <SortableHeader
              field="title"
              label="Ticket"
              activeField={sortBy}
              direction={sortDirection}
              onSort={onSort}
            />
            <th scope="col">Customer</th>
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
            <th scope="col">Assignee</th>
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
              <th scope="row">
                <span className="ticket-id">{ticket.id}</span>
                <span className="ticket-title">{ticket.title}</span>
              </th>
              <td>{ticket.customer.name}</td>
              <td>
                <span className={`badge status-${ticket.status}`}>
                  {getStatusLabel(ticket.status)}
                </span>
              </td>
              <td>
                <span className={`badge priority-${ticket.priority}`}>
                  {getPriorityLabel(ticket.priority)}
                </span>
              </td>
              <td>{ticket.assignee?.name ?? 'Unassigned'}</td>
              <td>
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
