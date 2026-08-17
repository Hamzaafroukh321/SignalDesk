import { createContext, useContext } from 'react'

export interface AnnouncementOptions {
  clearAfterMs?: number
  priority?: 'polite' | 'assertive'
}

export interface AnnouncementContextValue {
  announce: (message: string, options?: AnnouncementOptions) => void
}

export const AnnouncementContext =
  createContext<AnnouncementContextValue | null>(null)

export function useAnnouncements() {
  const context = useContext(AnnouncementContext)
  if (!context) {
    throw new Error('useAnnouncements must be used within AnnouncementProvider.')
  }
  return context
}
