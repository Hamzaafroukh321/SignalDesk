import { useEffect, useRef, useState } from 'react'
import { fixtureAssignees, fixtureTags } from '../../data/ticketFixtures'
import {
  getPriorityLabel,
  getStatusLabel,
  ticketPriorities,
  ticketStatuses,
  type Ticket,
  type TicketPriority,
  type TicketStatus,
} from '../../domain/ticket'
import {
  TicketVersionConflictError,
  type TicketChanges,
} from '../../data/ticketRepository'

interface TicketDraft {
  title: string
  status: TicketStatus
  priority: TicketPriority
  assigneeId: string
  description: string
  tagIds: string[]
}

type ValidatedField = 'title' | 'description'
type ValidationErrors = Partial<Record<ValidatedField, string>>

type SaveError =
  | { kind: 'ordinary' }
  | { kind: 'conflict'; ticket: Ticket }

const TITLE_MIN_LENGTH = 4
const TITLE_MAX_LENGTH = 120
const DESCRIPTION_MIN_LENGTH = 20
const DESCRIPTION_MAX_LENGTH = 2_000

interface TicketEditFormProps {
  ticket: Ticket
  onSave: (changes: TicketChanges) => Promise<void>
  onCancel: () => void
}

function createDraft(ticket: Ticket): TicketDraft {
  return {
    title: ticket.title,
    status: ticket.status,
    priority: ticket.priority,
    assigneeId: ticket.assignee?.id ?? '',
    description: ticket.description,
    tagIds: ticket.tags.map((tag) => tag.id),
  }
}

function validateTitle(value: string) {
  const length = value.trim().length
  if (length === 0) return 'Enter a ticket title.'
  if (length < TITLE_MIN_LENGTH) {
    return `Title must be at least ${TITLE_MIN_LENGTH} characters.`
  }
  if (length > TITLE_MAX_LENGTH) {
    return `Title must be ${TITLE_MAX_LENGTH} characters or fewer.`
  }
  return undefined
}

function validateDescription(value: string) {
  const length = value.trim().length
  if (length === 0) return 'Enter a ticket description.'
  if (length < DESCRIPTION_MIN_LENGTH) {
    return `Description must be at least ${DESCRIPTION_MIN_LENGTH} characters.`
  }
  if (length > DESCRIPTION_MAX_LENGTH) {
    return `Description must be ${DESCRIPTION_MAX_LENGTH} characters or fewer.`
  }
  return undefined
}

function validateDraft(draft: TicketDraft) {
  const errors: ValidationErrors = {}
  const title = validateTitle(draft.title)
  const description = validateDescription(draft.description)
  if (title) errors.title = title
  if (description) errors.description = description
  return errors
}

export function TicketEditForm({
  ticket,
  onSave,
  onCancel,
}: TicketEditFormProps) {
  const [draft, setDraft] = useState(() => createDraft(ticket))
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<SaveError | null>(null)
  const [validationErrors, setValidationErrors] =
    useState<ValidationErrors>({})
  const [summaryFocusRequest, setSummaryFocusRequest] = useState(0)
  const titleRef = useRef<HTMLInputElement>(null)
  const errorSummaryRef = useRef<HTMLDivElement>(null)
  const savingRef = useRef(false)

  useEffect(() => {
    titleRef.current?.focus()
  }, [])

  useEffect(() => {
    if (summaryFocusRequest > 0) errorSummaryRef.current?.focus()
  }, [summaryFocusRequest])

  const updateValidationError = (field: ValidatedField, value: string) => {
    setValidationErrors((current) => {
      if (!current[field]) return current
      const next = { ...current }
      const message =
        field === 'title' ? validateTitle(value) : validateDescription(value)
      if (message) next[field] = message
      else delete next[field]
      return next
    })
  }

  const toggleTag = (tagId: string, checked: boolean) => {
    setDraft((current) => ({
      ...current,
      tagIds: checked
        ? fixtureTags
            .filter(
              (tag) => tag.id === tagId || current.tagIds.includes(tag.id),
            )
            .map((tag) => tag.id)
        : current.tagIds.filter((id) => id !== tagId),
    }))
  }

  const submit = async () => {
    if (savingRef.current) return

    const errors = validateDraft(draft)
    if (Object.keys(errors).length > 0) {
      setValidationErrors(errors)
      setSummaryFocusRequest((request) => request + 1)
      return
    }

    savingRef.current = true
    setSaving(true)
    setSaveError(null)
    setValidationErrors({})
    try {
      await onSave({
        title: draft.title,
        status: draft.status,
        priority: draft.priority,
        assignee:
          fixtureAssignees.find((assignee) => assignee.id === draft.assigneeId) ??
          null,
        description: draft.description,
        tags: fixtureTags.filter((tag) => draft.tagIds.includes(tag.id)),
      })
    } catch (error) {
      setSaveError(
        error instanceof TicketVersionConflictError
          ? { kind: 'conflict', ticket: error.currentTicket }
          : { kind: 'ordinary' },
      )
      savingRef.current = false
      setSaving(false)
    }
  }

  return (
    <form
      className="ticket-edit-form"
      noValidate
      onSubmit={(event) => {
        event.preventDefault()
        void submit()
      }}
    >
      {Object.keys(validationErrors).length > 0 ? (
        <div
          ref={errorSummaryRef}
          className="edit-error-summary full-field"
          role="alert"
          tabIndex={-1}
          aria-labelledby="edit-error-summary-title"
        >
          <h3 id="edit-error-summary-title">
            Fix {Object.keys(validationErrors).length}{' '}
            {Object.keys(validationErrors).length === 1 ? 'error' : 'errors'}
            {' before saving'}
          </h3>
          <ul>
            {validationErrors.title ? (
              <li>{validationErrors.title}</li>
            ) : null}
            {validationErrors.description ? (
              <li>{validationErrors.description}</li>
            ) : null}
          </ul>
        </div>
      ) : null}

      <div className="edit-field full-field">
        <label htmlFor="edit-ticket-title">Title</label>
        <input
          ref={titleRef}
          id="edit-ticket-title"
          type="text"
          required
          value={draft.title}
          disabled={saving}
          aria-invalid={validationErrors.title ? 'true' : undefined}
          aria-describedby={`edit-ticket-title-hint${
            validationErrors.title ? ' edit-ticket-title-error' : ''
          }`}
          onChange={(event) => {
            const title = event.currentTarget.value
            updateValidationError('title', title)
            setDraft((current) => ({
              ...current,
              title,
            }))
          }}
        />
        <p id="edit-ticket-title-hint" className="edit-field-hint">
          {TITLE_MIN_LENGTH}–{TITLE_MAX_LENGTH} characters
        </p>
        {validationErrors.title ? (
          <p id="edit-ticket-title-error" className="edit-field-error">
            {validationErrors.title}
          </p>
        ) : null}
      </div>

      <div className="edit-field">
        <label htmlFor="edit-ticket-status">Status</label>
        <select
          id="edit-ticket-status"
          value={draft.status}
          disabled={saving}
          onChange={(event) => {
            const status = event.currentTarget.value as TicketStatus
            setDraft((current) => ({
              ...current,
              status,
            }))
          }}
        >
          {ticketStatuses.map((status) => (
            <option key={status} value={status}>
              {getStatusLabel(status)}
            </option>
          ))}
        </select>
      </div>

      <div className="edit-field">
        <label htmlFor="edit-ticket-priority">Priority</label>
        <select
          id="edit-ticket-priority"
          value={draft.priority}
          disabled={saving}
          onChange={(event) => {
            const priority = event.currentTarget.value as TicketPriority
            setDraft((current) => ({
              ...current,
              priority,
            }))
          }}
        >
          {ticketPriorities.map((priority) => (
            <option key={priority} value={priority}>
              {getPriorityLabel(priority)}
            </option>
          ))}
        </select>
      </div>

      <div className="edit-field full-field">
        <label htmlFor="edit-ticket-assignee">Assignee</label>
        <select
          id="edit-ticket-assignee"
          value={draft.assigneeId}
          disabled={saving}
          onChange={(event) => {
            const assigneeId = event.currentTarget.value
            setDraft((current) => ({
              ...current,
              assigneeId,
            }))
          }}
        >
          <option value="">Unassigned</option>
          {fixtureAssignees.map((assignee) => (
            <option key={assignee.id} value={assignee.id}>
              {assignee.name}
            </option>
          ))}
        </select>
      </div>

      <div className="edit-field full-field">
        <label htmlFor="edit-ticket-description">Description</label>
        <textarea
          id="edit-ticket-description"
          rows={6}
          required
          value={draft.description}
          disabled={saving}
          aria-invalid={validationErrors.description ? 'true' : undefined}
          aria-describedby={`edit-ticket-description-hint${
            validationErrors.description
              ? ' edit-ticket-description-error'
              : ''
          }`}
          onChange={(event) => {
            const description = event.currentTarget.value
            updateValidationError('description', description)
            setDraft((current) => ({
              ...current,
              description,
            }))
          }}
        />
        <p id="edit-ticket-description-hint" className="edit-field-hint">
          {DESCRIPTION_MIN_LENGTH}–{DESCRIPTION_MAX_LENGTH.toLocaleString('en')}{' '}
          characters
        </p>
        {validationErrors.description ? (
          <p id="edit-ticket-description-error" className="edit-field-error">
            {validationErrors.description}
          </p>
        ) : null}
      </div>

      <fieldset className="tag-editor full-field" disabled={saving}>
        <legend>Tags</legend>
        <div>
          {fixtureTags.map((tag) => (
            <label key={tag.id}>
              <input
                type="checkbox"
                checked={draft.tagIds.includes(tag.id)}
                onChange={(event) =>
                  toggleTag(tag.id, event.currentTarget.checked)
                }
              />
              <span>{tag.label}</span>
            </label>
          ))}
        </div>
      </fieldset>

      {saveError ? (
        <div className="edit-save-error">
          <h3>
            {saveError.kind === 'conflict'
              ? 'Review a newer ticket version'
              : 'Ticket save failed'}
          </h3>
          {saveError.kind === 'conflict' ? (
            <p>
              This ticket changed elsewhere and is now version{' '}
              {saveError.ticket.version}. The latest saved title is “
              {saveError.ticket.title}”. Your draft is still here; review it,
              then retry.
            </p>
          ) : (
            <p>
              The last saved values were restored in the ticket list. Your
              draft is still here; check your connection and retry.
            </p>
          )}
        </div>
      ) : null}

      <div className="edit-actions full-field">
        <button
          className="secondary-button"
          type="button"
          disabled={saving}
          onClick={onCancel}
        >
          Cancel editing
        </button>
        <button className="primary-button" type="submit" disabled={saving}>
          {saving ? 'Saving ticket…' : saveError ? 'Retry save' : 'Save ticket'}
        </button>
      </div>
    </form>
  )
}
