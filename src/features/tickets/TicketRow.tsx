import { memo } from 'react'
import {
  getPriorityLabel,
  getStatusLabel,
  type Ticket,
  type TicketId,
} from '../../domain/ticket'

export interface TicketRowProps {
  ticket: Ticket
  selected: boolean
  selectionDisabled: boolean
  onSelectionChange: (id: TicketId, checked: boolean) => void
  onOpenTicket: (id: TicketId, trigger: HTMLButtonElement) => void
}

const dateFormatter = new Intl.DateTimeFormat('en', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
  timeZone: 'UTC',
})

export const TicketRow = memo(function TicketRow({
  ticket,
  selected,
  selectionDisabled,
  onSelectionChange,
  onOpenTicket,
}: TicketRowProps) {
  return (
    <tr>
      <td className="selection-column">
        <input
          type="checkbox"
          checked={selected}
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
          onClick={(event) => onOpenTicket(ticket.id, event.currentTarget)}
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
  )
})
