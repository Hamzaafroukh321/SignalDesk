import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import {
  AnnouncementContext,
  type AnnouncementOptions,
} from './announcementContext'

interface AnnouncementProviderProps {
  children: ReactNode
}

interface Announcement {
  id: number
  message: string
}

type AnnouncementPriority = NonNullable<AnnouncementOptions['priority']>

type AnnouncementState = Record<AnnouncementPriority, Announcement | null>

const DEFAULT_CLEAR_DELAY_MS = 6_500

export function AnnouncementProvider({
  children,
}: AnnouncementProviderProps) {
  const [announcements, setAnnouncements] = useState<AnnouncementState>({
    polite: null,
    assertive: null,
  })
  const nextIdRef = useRef(0)
  const mountedRef = useRef(false)
  const clearTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    mountedRef.current = true
    return () => {
      mountedRef.current = false
      if (clearTimerRef.current !== null) {
        clearTimeout(clearTimerRef.current)
        clearTimerRef.current = null
      }
    }
  }, [])

  const announce = useCallback(
    (message: string, options: AnnouncementOptions = {}) => {
      const conciseMessage = message.trim()
      if (!mountedRef.current || !conciseMessage) return

      if (clearTimerRef.current !== null) {
        clearTimeout(clearTimerRef.current)
        clearTimerRef.current = null
      }

      const id = nextIdRef.current + 1
      nextIdRef.current = id
      const priority = options.priority ?? 'polite'
      setAnnouncements({
        polite: priority === 'polite' ? { id, message: conciseMessage } : null,
        assertive:
          priority === 'assertive' ? { id, message: conciseMessage } : null,
      })

      const clearAfterMs = options.clearAfterMs ?? DEFAULT_CLEAR_DELAY_MS
      if (clearAfterMs <= 0) return
      clearTimerRef.current = setTimeout(() => {
        clearTimerRef.current = null
        if (!mountedRef.current) return
        setAnnouncements((current) =>
          current[priority]?.id === id
            ? { ...current, [priority]: null }
            : current,
        )
      }, clearAfterMs)
    },
    [],
  )

  const contextValue = useMemo(() => ({ announce }), [announce])

  return (
    <AnnouncementContext.Provider value={contextValue}>
      {children}
      <div
        className="visually-hidden"
        role="status"
        aria-live="polite"
        aria-atomic="true"
        data-testid="polite-operation-announcements"
      >
        {announcements.polite ? (
          <span key={announcements.polite.id}>
            {announcements.polite.message}
          </span>
        ) : null}
      </div>
      <div
        className="visually-hidden"
        role="alert"
        aria-live="assertive"
        aria-atomic="true"
        data-testid="assertive-operation-announcements"
      >
        {announcements.assertive ? (
          <span key={announcements.assertive.id}>
            {announcements.assertive.message}
          </span>
        ) : null}
      </div>
    </AnnouncementContext.Provider>
  )
}
