import { useEffect, useRef, useState } from 'react'

interface TicketNoteComposerProps {
  onAddNote: (body: string) => Promise<void>
}

type NoteError =
  | { kind: 'validation'; message: string }
  | { kind: 'failure'; message: string }

export function TicketNoteComposer({ onAddNote }: TicketNoteComposerProps) {
  const [body, setBody] = useState('')
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<NoteError | null>(null)
  const [focusRequest, setFocusRequest] = useState(0)
  const pendingRef = useRef(false)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    if (focusRequest > 0) textareaRef.current?.focus()
  }, [focusRequest])

  const submit = async () => {
    if (pendingRef.current) return
    const note = body.trim()
    if (!note) {
      setError({
        kind: 'validation',
        message: 'Enter a note before submitting.',
      })
      setFocusRequest((request) => request + 1)
      return
    }

    pendingRef.current = true
    setPending(true)
    setError(null)
    try {
      await onAddNote(note)
      setBody('')
    } catch {
      setError({
        kind: 'failure',
        message: 'The note could not be added. Your text is still here; try again.',
      })
    } finally {
      pendingRef.current = false
      setPending(false)
      setFocusRequest((request) => request + 1)
    }
  }

  return (
    <section className="note-composer" aria-labelledby="note-composer-title">
      <h3 id="note-composer-title">Add a note</h3>
      <form
        noValidate
        aria-busy={pending}
        onSubmit={(event) => {
          event.preventDefault()
          void submit()
        }}
      >
        <label htmlFor="ticket-note">Note</label>
        <textarea
          ref={textareaRef}
          id="ticket-note"
          rows={4}
          value={body}
          disabled={pending}
          aria-invalid={error?.kind === 'validation' ? 'true' : undefined}
          aria-describedby={error ? 'ticket-note-error' : 'ticket-note-hint'}
          onChange={(event) => {
            const value = event.currentTarget.value
            setBody(value)
            if (error?.kind === 'validation' && value.trim()) setError(null)
          }}
        />
        {error ? (
          <p
            id="ticket-note-error"
            className="note-error"
            role={error.kind === 'validation' ? 'alert' : undefined}
          >
            {error.message}
          </p>
        ) : (
          <p id="ticket-note-hint" className="note-hint">
            Notes are added to the end of the activity timeline.
          </p>
        )}
        <button className="primary-button" type="submit" disabled={pending}>
          {pending
            ? 'Adding note…'
            : error?.kind === 'failure'
              ? 'Retry note'
              : 'Add note'}
        </button>
      </form>
    </section>
  )
}
