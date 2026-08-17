import { act, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  AnnouncementProvider,
} from './AnnouncementProvider'
import { useAnnouncements } from './announcementContext'

type Announce = ReturnType<typeof useAnnouncements>['announce']

function AnnouncementHarness({ capture }: { capture: (value: Announce) => void }) {
  const { announce } = useAnnouncements()
  capture(announce)

  return (
    <>
      <button
        type="button"
        onClick={() => announce('Ticket saved.', { clearAfterMs: 1_000 })}
      >
        Announce success
      </button>
      <button
        type="button"
        onClick={() =>
          announce('Ticket save failed.', {
            clearAfterMs: 1_000,
            priority: 'assertive',
          })
        }
      >
        Announce failure
      </button>
    </>
  )
}

describe('AnnouncementProvider', () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  it('keeps only the latest concise outcome and clears it safely', () => {
    vi.useFakeTimers()
    let capturedAnnounce: Announce | undefined
    render(
      <AnnouncementProvider>
        <AnnouncementHarness
          capture={(announce) => {
            capturedAnnounce = announce
          }}
        />
      </AnnouncementProvider>,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Announce success' }))
    expect(screen.getByTestId('polite-operation-announcements')).toHaveTextContent(
      'Ticket saved.',
    )

    fireEvent.click(screen.getByRole('button', { name: 'Announce failure' }))
    expect(screen.getByTestId('polite-operation-announcements')).toBeEmptyDOMElement()
    expect(
      screen.getByTestId('assertive-operation-announcements'),
    ).toHaveTextContent('Ticket save failed.')
    expect(vi.getTimerCount()).toBe(1)

    act(() => vi.advanceTimersByTime(1_000))
    expect(
      screen.getByTestId('assertive-operation-announcements'),
    ).toBeEmptyDOMElement()
    expect(vi.getTimerCount()).toBe(0)
    expect(capturedAnnounce).toBeDefined()
  })

  it('cancels timers and ignores retained callbacks after teardown', () => {
    vi.useFakeTimers()
    let capturedAnnounce: Announce | undefined
    const view = render(
      <AnnouncementProvider>
        <AnnouncementHarness
          capture={(announce) => {
            capturedAnnounce = announce
          }}
        />
      </AnnouncementProvider>,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Announce success' }))
    expect(vi.getTimerCount()).toBe(1)
    view.unmount()
    expect(vi.getTimerCount()).toBe(0)

    act(() => {
      capturedAnnounce?.('Late stale outcome.')
      vi.runAllTimers()
    })
    expect(vi.getTimerCount()).toBe(0)
  })
})
