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
import type { TicketChanges } from '../../data/ticketRepository'

interface TicketDraft {
  title: string
  status: TicketStatus
  priority: TicketPriority
  assigneeId: string
  description: string
  tagIds: string[]
}

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

export function TicketEditForm({
  ticket,
  onSave,
  onCancel,
}: TicketEditFormProps) {
  const [draft, setDraft] = useState(() => createDraft(ticket))
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState('')
  const titleRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    titleRef.current?.focus()
  }, [])

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
    setSaving(true)
    setSaveError('')
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
    } catch {
      setSaveError('The ticket could not be saved. Your edits are still here.')
      setSaving(false)
    }
  }

  return (
    <form
      className="ticket-edit-form"
      onSubmit={(event) => {
        event.preventDefault()
        void submit()
      }}
    >
      <div className="edit-field full-field">
        <label htmlFor="edit-ticket-title">Title</label>
        <input
          ref={titleRef}
          id="edit-ticket-title"
          type="text"
          required
          value={draft.title}
          disabled={saving}
          onChange={(event) => {
            const title = event.currentTarget.value
            setDraft((current) => ({
              ...current,
              title,
            }))
          }}
        />
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
          onChange={(event) => {
            const description = event.currentTarget.value
            setDraft((current) => ({
              ...current,
              description,
            }))
          }}
        />
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
        <p className="edit-save-error" role="alert">
          {saveError}
        </p>
      ) : null}

      <div className="edit-actions full-field">
        <button className="secondary-button" type="button" disabled={saving} onClick={onCancel}>
          Cancel editing
        </button>
        <button className="primary-button" type="submit" disabled={saving}>
          {saving ? 'Saving ticket…' : 'Save ticket'}
        </button>
      </div>
    </form>
  )
}
