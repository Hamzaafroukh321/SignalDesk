import { useEffect, useRef, useState } from 'react'
import { useAnnouncements } from '../../components/announcementContext'
import {
  MAX_SAVED_VIEW_NAME_LENGTH,
  loadSavedViews,
  nextSavedViewId,
  normalizeSavedViewName,
  persistSavedViews,
  type SavedView,
  type SavedViewDefinition,
} from './savedViews'

interface SavedViewsPanelProps {
  currentDefinition: SavedViewDefinition
  onApply: (definition: SavedViewDefinition) => void
}

interface Feedback {
  kind: 'success' | 'error'
  message: string
  field?: 'save' | 'rename'
}

type PendingFocus =
  | { kind: 'rename'; id: string }
  | { kind: 'rename-input' }
  | { kind: 'name-input' }

function cloneDefinition(
  definition: SavedViewDefinition,
): SavedViewDefinition {
  return {
    ...definition,
    statuses: [...definition.statuses],
    priorities: [...definition.priorities],
  }
}

export function SavedViewsPanel({
  currentDefinition,
  onApply,
}: SavedViewsPanelProps) {
  const { announce } = useAnnouncements()
  const [initialLoad] = useState(() => loadSavedViews())
  const [views, setViews] = useState(initialLoad.views)
  const [viewName, setViewName] = useState('')
  const [renamingId, setRenamingId] = useState<string | null>(null)
  const [renameValue, setRenameValue] = useState('')
  const nameInputRef = useRef<HTMLInputElement>(null)
  const renameInputRef = useRef<HTMLInputElement>(null)
  const renameButtonRefs = useRef(new Map<string, HTMLButtonElement>())
  const pendingFocusRef = useRef<PendingFocus | null>(null)
  const [feedback, setFeedback] = useState<Feedback | null>(() => {
    if (initialLoad.issue === 'malformed') {
      return {
        kind: 'error',
        message: 'Saved view data was malformed and has been ignored.',
      }
    }
    if (initialLoad.issue === 'unavailable') {
      return {
        kind: 'error',
        message: 'Saved views are unavailable in this browser.',
      }
    }
    return null
  })

  useEffect(() => {
    if (renamingId !== null) renameInputRef.current?.focus()
  }, [renamingId])

  useEffect(() => {
    const pendingFocus = pendingFocusRef.current
    if (!pendingFocus) return
    const target =
      pendingFocus.kind === 'rename'
        ? renameButtonRefs.current.get(pendingFocus.id)
        : pendingFocus.kind === 'rename-input'
          ? renameInputRef.current
          : nameInputRef.current
    if (!target) return
    target.focus()
    pendingFocusRef.current = null
  }, [renamingId, views])

  const nameError = (candidate: string, ignoredId?: string) => {
    const name = normalizeSavedViewName(candidate)
    if (!name) return 'Enter a view name.'
    if (name.length > MAX_SAVED_VIEW_NAME_LENGTH) {
      return `View names must be ${MAX_SAVED_VIEW_NAME_LENGTH} characters or fewer.`
    }
    if (
      views.some(
        (view) =>
          view.id !== ignoredId &&
          view.name.toLowerCase() === name.toLowerCase(),
      )
    ) {
      return 'Use a unique view name.'
    }
    return null
  }

  const commitViews = (nextViews: SavedView[], successMessage: string) => {
    if (!persistSavedViews(nextViews)) {
      const message =
        'SignalDesk could not store that change. Your saved views were not changed.'
      setFeedback({
        kind: 'error',
        message,
      })
      announce(message, { priority: 'assertive' })
      return false
    }
    setViews(nextViews)
    setFeedback({ kind: 'success', message: successMessage })
    announce(successMessage)
    return true
  }

  const saveCurrentView = () => {
    const error = nameError(viewName)
    if (error) {
      setFeedback({ kind: 'error', message: error, field: 'save' })
      nameInputRef.current?.focus()
      return
    }
    const name = normalizeSavedViewName(viewName)
    const nextViews = [
      ...views,
      {
        id: nextSavedViewId(views),
        name,
        definition: cloneDefinition(currentDefinition),
      },
    ]
    if (commitViews(nextViews, `Saved view ${name}.`)) setViewName('')
  }

  const beginRename = (view: SavedView) => {
    setRenamingId(view.id)
    setRenameValue(view.name)
    setFeedback(null)
  }

  const renameView = (view: SavedView) => {
    const error = nameError(renameValue, view.id)
    if (error) {
      setFeedback({ kind: 'error', message: error, field: 'rename' })
      renameInputRef.current?.focus()
      return
    }
    const name = normalizeSavedViewName(renameValue)
    const nextViews = views.map((candidate) =>
      candidate.id === view.id ? { ...candidate, name } : candidate,
    )
    if (commitViews(nextViews, `Renamed view ${view.name} to ${name}.`)) {
      pendingFocusRef.current = { kind: 'rename', id: view.id }
      setRenamingId(null)
      setRenameValue('')
    }
  }

  const deleteView = (view: SavedView) => {
    const deletedIndex = views.findIndex((candidate) => candidate.id === view.id)
    const nextViews = views.filter((candidate) => candidate.id !== view.id)
    if (commitViews(nextViews, `Deleted view ${view.name}.`)) {
      const nextFocusView =
        nextViews[deletedIndex] ?? nextViews[deletedIndex - 1]
      pendingFocusRef.current =
        renamingId !== null
          ? { kind: 'rename-input' }
          : nextFocusView
            ? { kind: 'rename', id: nextFocusView.id }
            : { kind: 'name-input' }
    }
  }

  const cancelRename = () => {
    if (renamingId !== null) {
      pendingFocusRef.current = { kind: 'rename', id: renamingId }
    }
    setRenamingId(null)
    setRenameValue('')
    setFeedback(null)
  }

  return (
    <section className="saved-views" aria-labelledby="saved-views-title">
      <div>
        <p className="panel-kicker">Local workspace</p>
        <h3 id="saved-views-title">Saved views</h3>
      </div>

      <form
        className="save-view-form"
        onSubmit={(event) => {
          event.preventDefault()
          saveCurrentView()
        }}
      >
        <label htmlFor="saved-view-name">View name</label>
        <div>
          <input
            ref={nameInputRef}
            id="saved-view-name"
            type="text"
            value={viewName}
            aria-invalid={feedback?.field === 'save' ? 'true' : undefined}
            aria-describedby={
              feedback?.field === 'save' ? 'saved-view-feedback' : undefined
            }
            onChange={(event) => {
              setViewName(event.currentTarget.value)
              if (feedback?.field === 'save') setFeedback(null)
            }}
          />
          <button className="secondary-button" type="submit">
            Save current view
          </button>
        </div>
      </form>

      {feedback ? (
        <p
          id="saved-view-feedback"
          className={`saved-view-feedback ${
            feedback.kind === 'error' ? 'error-feedback' : 'success-feedback'
          }`}
        >
          {feedback.message}
        </p>
      ) : null}

      {views.length ? (
        <ul className="saved-view-list">
          {views.map((view) => (
            <li key={view.id}>
              {renamingId === view.id ? (
                <form
                  className="rename-view-form"
                  onSubmit={(event) => {
                    event.preventDefault()
                    renameView(view)
                  }}
                >
                  <label htmlFor={`rename-${view.id}`}>
                    New name for {view.name}
                  </label>
                  <input
                    ref={renameInputRef}
                    id={`rename-${view.id}`}
                    type="text"
                    value={renameValue}
                    aria-invalid={
                      feedback?.field === 'rename' ? 'true' : undefined
                    }
                    aria-describedby={
                      feedback?.field === 'rename'
                        ? 'saved-view-feedback'
                        : undefined
                    }
                    onChange={(event) => {
                      setRenameValue(event.currentTarget.value)
                      if (feedback?.field === 'rename') setFeedback(null)
                    }}
                  />
                  <div>
                    <button className="secondary-button" type="submit">
                      Save rename
                    </button>
                    <button
                      className="clear-button"
                      type="button"
                      onClick={cancelRename}
                    >
                      Cancel rename
                    </button>
                  </div>
                </form>
              ) : (
                <>
                  <span>{view.name}</span>
                  <div>
                    <button
                      className="secondary-button"
                      type="button"
                      onClick={() => {
                        onApply(cloneDefinition(view.definition))
                        const message = `Applied view ${view.name}.`
                        setFeedback({ kind: 'success', message })
                        announce(message)
                      }}
                    >
                      Apply {view.name}
                    </button>
                    <button
                      ref={(button) => {
                        if (button) renameButtonRefs.current.set(view.id, button)
                        else renameButtonRefs.current.delete(view.id)
                      }}
                      className="clear-button"
                      type="button"
                      onClick={() => beginRename(view)}
                    >
                      Rename {view.name}
                    </button>
                    <button
                      className="clear-button danger-text-button"
                      type="button"
                      onClick={() => deleteView(view)}
                    >
                      Delete {view.name}
                    </button>
                  </div>
                </>
              )}
            </li>
          ))}
        </ul>
      ) : (
        <p className="saved-view-empty">No saved views yet.</p>
      )}
    </section>
  )
}
