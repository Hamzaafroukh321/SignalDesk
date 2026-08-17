import {
  getPriorityLabel,
  getStatusLabel,
  type Ticket,
  type TicketId,
} from '../../domain/ticket'

export type TicketDetailResource =
  | { status: 'loading'; ticketId: TicketId }
  | { status: 'success'; ticket: Ticket }
  | { status: 'error'; ticketId: TicketId }

interface TicketDetailsDialogProps {
  detail: TicketDetailResource
  onClose: () => void
  onRetry: () => void
}

const dateTimeFormatter = new Intl.DateTimeFormat('en', {
  dateStyle: 'medium',
  timeStyle: 'short',
  timeZone: 'UTC',
})

function formatDateTime(value: string) {
  return dateTimeFormatter.format(new Date(value))
}

export function TicketDetailsDialog({
  detail,
  onClose,
  onRetry,
}: TicketDetailsDialogProps) {
  const ticket = detail.status === 'success' ? detail.ticket : null
  const ticketId = detail.status === 'success' ? detail.ticket.id : detail.ticketId

  return (
    <div className="dialog-layer">
      <dialog
        open
        className="ticket-dialog"
        aria-modal="true"
        aria-labelledby="ticket-dialog-title"
      >
        <div className="dialog-header">
          <div>
            <p className="panel-kicker">
              {ticketId}
            </p>
            <h2 id="ticket-dialog-title">
              {ticket?.title ?? 'Ticket details'}
            </h2>
          </div>
          <button className="dialog-close" type="button" onClick={onClose}>
            Close details
          </button>
        </div>

        {detail.status === 'loading' ? (
          <div className="dialog-state">
            <span className="loading-mark" aria-hidden="true" />
            <p role="status">Loading {detail.ticketId} details…</p>
          </div>
        ) : null}

        {detail.status === 'error' ? (
          <div className="dialog-state dialog-error" role="alert">
            <span className="error-mark" aria-hidden="true">
              !
            </span>
            <div>
              <h3>Ticket details are unavailable</h3>
              <p>SignalDesk could not load {detail.ticketId}. The queue is unchanged.</p>
              <button className="secondary-button" type="button" onClick={onRetry}>
                Retry ticket details
              </button>
            </div>
          </div>
        ) : null}

        {ticket ? (
          <div className="ticket-detail-content">
            <dl className="ticket-facts">
              <div>
                <dt>Status</dt>
                <dd>{getStatusLabel(ticket.status)}</dd>
              </div>
              <div>
                <dt>Priority</dt>
                <dd>{getPriorityLabel(ticket.priority)}</dd>
              </div>
              <div>
                <dt>Assignee</dt>
                <dd>{ticket.assignee?.name ?? 'Unassigned'}</dd>
              </div>
              <div>
                <dt>Customer</dt>
                <dd>{ticket.customer.name}</dd>
              </div>
              <div>
                <dt>Created</dt>
                <dd>
                  <time dateTime={ticket.createdAt}>
                    {formatDateTime(ticket.createdAt)}
                  </time>
                </dd>
              </div>
              <div>
                <dt>Updated</dt>
                <dd>
                  <time dateTime={ticket.updatedAt}>
                    {formatDateTime(ticket.updatedAt)}
                  </time>
                </dd>
              </div>
            </dl>

            <section className="detail-section" aria-labelledby="description-title">
              <h3 id="description-title">Description</h3>
              <p>{ticket.description}</p>
            </section>

            <section className="detail-section" aria-labelledby="tags-title">
              <h3 id="tags-title">Tags</h3>
              <ul className="tag-list">
                {ticket.tags.map((tag) => (
                  <li key={tag.id}>{tag.label}</li>
                ))}
              </ul>
            </section>

            <section className="detail-section" aria-labelledby="activity-title">
              <h3 id="activity-title">Activity</h3>
              <ol className="activity-list">
                {ticket.activities.map((activity) => (
                  <li key={activity.id}>
                    <p>{activity.message}</p>
                    <span>
                      {activity.author} ·{' '}
                      <time dateTime={activity.createdAt}>
                        {formatDateTime(activity.createdAt)}
                      </time>
                    </span>
                  </li>
                ))}
              </ol>
            </section>
          </div>
        ) : null}
      </dialog>
    </div>
  )
}
