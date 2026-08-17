import { getPriorityLabel, getStatusLabel, type Ticket } from '../../domain/ticket'

interface TicketTableProps {
  tickets: readonly Ticket[]
  totalCount: number
}

const dateFormatter = new Intl.DateTimeFormat('en', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
  timeZone: 'UTC',
})

export function TicketTable({ tickets, totalCount }: TicketTableProps) {
  return (
    <div className="table-scroll">
      <table className="ticket-table">
        <caption>
          Current ticket queue — showing {tickets.length} of {totalCount}
        </caption>
        <thead>
          <tr>
            <th scope="col">Ticket</th>
            <th scope="col">Customer</th>
            <th scope="col">Status</th>
            <th scope="col">Priority</th>
            <th scope="col">Assignee</th>
            <th scope="col">Updated</th>
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
