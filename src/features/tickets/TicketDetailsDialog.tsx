import { useEffect, useRef, useState } from 'react'
import type { FocusEvent, KeyboardEvent } from 'react'
import {
  getPriorityLabel,
  getStatusLabel,
  type Ticket,
  type TicketId,
} from '../../domain/ticket'
import type { TicketChanges } from '../../data/ticketRepository'
import { TicketEditForm } from './TicketEditForm'
import { TicketNoteComposer } from './TicketNoteComposer'

export type TicketDetailResource =
  | { status: 'loading'; ticketId: TicketId }
  | { status: 'success'; ticket: Ticket }
  | { status: 'error'; ticketId: TicketId }

interface TicketDetailsDialogProps {
  detail: TicketDetailResource
  authoritativeTicket: Ticket | null
  onClose: () => void
  onRetry: () => void
  onSave: (changes: TicketChanges) => Promise<void>
  onAddNote: (body: string) => Promise<void>
  onEditDirtyChange: (dirty: boolean) => void
  discardIntent: 'close' | 'switch' | null
  onContinueEditing: () => void
  onDiscardChanges: () => void
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
  authoritativeTicket,
  onClose,
  onRetry,
  onSave,
  onAddNote,
  onEditDirtyChange,
  discardIntent,
  onContinueEditing,
  onDiscardChanges,
}: TicketDetailsDialogProps) {
  const ticket = detail.status === 'success' ? detail.ticket : null
  const ticketId = detail.status === 'success' ? detail.ticket.id : detail.ticketId
  const dialogRef = useRef<HTMLDialogElement>(null)
  const closeButtonRef = useRef<HTMLButtonElement>(null)
  const editButtonRef = useRef<HTMLButtonElement>(null)
  const confirmationRef = useRef<HTMLDivElement>(null)
  const continueButtonRef = useRef<HTMLButtonElement>(null)
  const [editing, setEditing] = useState(false)
  const restoreEditFocusRef = useRef(false)
  const restoreDraftFocusRef = useRef(false)
  const lastOrdinaryFocusRef = useRef<HTMLElement | null>(null)
  const previousTicketIdRef = useRef(ticketId)

  useEffect(() => {
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    closeButtonRef.current?.focus()

    return () => {
      document.body.style.overflow = previousOverflow
    }
  }, [])

  useEffect(() => {
    if (!editing && restoreEditFocusRef.current) {
      restoreEditFocusRef.current = false
      editButtonRef.current?.focus()
    }
  }, [editing])

  useEffect(() => {
    if (discardIntent) {
      continueButtonRef.current?.focus()
    } else if (restoreDraftFocusRef.current) {
      restoreDraftFocusRef.current = false
      const focusTarget = lastOrdinaryFocusRef.current
      if (focusTarget?.isConnected) focusTarget.focus()
      else {
        dialogRef.current
          ?.querySelector<HTMLInputElement>('#edit-ticket-title')
          ?.focus()
      }
    }
  }, [discardIntent])

  useEffect(() => {
    if (previousTicketIdRef.current !== ticketId) {
      previousTicketIdRef.current = ticketId
      if (!discardIntent) closeButtonRef.current?.focus()
    }
  }, [discardIntent, ticketId])

  const finishEditing = () => {
    onEditDirtyChange(false)
    restoreEditFocusRef.current = true
    setEditing(false)
  }

  const handleDialogKeyDown = (event: KeyboardEvent<HTMLDialogElement>) => {
    if (event.defaultPrevented) return

    if (event.key === 'Escape') {
      event.preventDefault()
      if (discardIntent) {
        restoreDraftFocusRef.current = true
        onContinueEditing()
      } else {
        onClose()
      }
      return
    }

    if (event.key !== 'Tab') return

    const focusRoot = discardIntent ? confirmationRef.current : dialogRef.current
    const focusable = [...(focusRoot?.querySelectorAll<HTMLElement>(
      'button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [href], [tabindex]:not([tabindex="-1"])',
    ) ?? [])]
    if (!focusable.length) {
      event.preventDefault()
      dialogRef.current?.focus()
      return
    }

    const first = focusable[0]
    const last = focusable.at(-1)
    if (!first || !last) return

    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault()
      last.focus()
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault()
      first.focus()
    } else if (!focusRoot?.contains(document.activeElement)) {
      event.preventDefault()
      first.focus()
    }
  }

  const rememberDialogFocus = (event: FocusEvent<HTMLDialogElement>) => {
    if (!discardIntent && event.target instanceof HTMLElement) {
      lastOrdinaryFocusRef.current = event.target
    }
  }

  return (
    <div className="dialog-layer">
      <dialog
        ref={dialogRef}
        open
        role={discardIntent ? 'alertdialog' : undefined}
        className="ticket-dialog"
        aria-modal="true"
        aria-labelledby={
          discardIntent ? 'discard-changes-title' : 'ticket-dialog-title'
        }
        onKeyDown={handleDialogKeyDown}
        onFocusCapture={rememberDialogFocus}
        onCancel={(event) => {
          event.preventDefault()
          if (discardIntent) {
            restoreDraftFocusRef.current = true
            onContinueEditing()
          } else {
            onClose()
          }
        }}
      >
        <div
          className="dialog-frame"
          aria-hidden={discardIntent ? 'true' : undefined}
          inert={discardIntent ? true : undefined}
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
          <div className="dialog-header-actions">
            {ticket && !editing ? (
              <button
                ref={editButtonRef}
                className="secondary-button"
                type="button"
                onClick={() => setEditing(true)}
              >
                Edit ticket
              </button>
            ) : null}
            <button
              ref={closeButtonRef}
              className="dialog-close"
              type="button"
              onClick={onClose}
            >
              Close details
            </button>
          </div>
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

        {ticket && editing ? (
          <TicketEditForm
            ticket={ticket}
            authoritativeTicket={authoritativeTicket ?? ticket}
            onSave={async (changes) => {
              await onSave(changes)
              finishEditing()
            }}
            onCancel={finishEditing}
            onDirtyChange={onEditDirtyChange}
          />
        ) : null}

        {ticket && !editing ? (
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
              <ol className="activity-list" aria-labelledby="activity-title">
                {ticket.activities.map((activity) => (
                  <li key={activity.id} data-activity-id={activity.id}>
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

            <TicketNoteComposer onAddNote={onAddNote} />
          </div>
        ) : null}
        </div>

        {discardIntent ? (
          <div ref={confirmationRef} className="discard-confirmation">
            <p className="panel-kicker">Unsaved ticket edits</p>
            <h2 id="discard-changes-title">Discard unsaved changes?</h2>
            <p>
              {discardIntent === 'switch'
                ? 'Opening another ticket will discard the edits in this form.'
                : 'Closing ticket details will discard the edits in this form.'}
            </p>
            <div className="discard-actions">
              <button
                ref={continueButtonRef}
                className="secondary-button"
                type="button"
                onClick={() => {
                  restoreDraftFocusRef.current = true
                  onContinueEditing()
                }}
              >
                Continue editing
              </button>
              <button
                className="danger-button"
                type="button"
                onClick={() => {
                  onEditDirtyChange(false)
                  setEditing(false)
                  onDiscardChanges()
                }}
              >
                Discard changes
              </button>
            </div>
          </div>
        ) : null}
      </dialog>
    </div>
  )
}
