import { describe, expect, it } from 'vitest'
import {
  SAVED_VIEWS_STORAGE_KEY,
  createSavedViewDefinition,
  loadSavedViews,
  nextSavedViewId,
  persistSavedViews,
  type SavedView,
  type StorageLike,
} from './savedViews'

class MemoryStorage implements StorageLike {
  readonly values = new Map<string, string>()

  getItem(key: string) {
    return this.values.get(key) ?? null
  }

  setItem(key: string, value: string) {
    this.values.set(key, value)
  }
}

const completeView: SavedView = {
  id: 'view-1',
  name: 'Urgent billing',
  definition: {
    search: 'Billing',
    statuses: ['new', 'open'],
    priorities: ['urgent'],
    sortBy: 'title',
    sortDirection: 'asc',
    pageSize: 20,
  },
}

describe('saved ticket views', () => {
  it('round-trips a complete versioned preference projection', () => {
    const storage = new MemoryStorage()

    expect(persistSavedViews([completeView], storage)).toBe(true)
    expect(JSON.parse(storage.getItem(SAVED_VIEWS_STORAGE_KEY) ?? '')).toEqual({
      version: 1,
      views: [completeView],
    })
    expect(storage.getItem(SAVED_VIEWS_STORAGE_KEY)).not.toContain('"page"')
    expect(storage.getItem(SAVED_VIEWS_STORAGE_KEY)).not.toContain('selected')

    const loaded = loadSavedViews(storage)
    expect(loaded).toEqual({ views: [completeView], issue: null })
    expect(loaded.views[0]).not.toBe(completeView)
    expect(loaded.views[0]?.definition.statuses).not.toBe(
      completeView.definition.statuses,
    )
  })

  it('projects only durable list preferences from active state', () => {
    const longSearch = 'invoice '.repeat(40)
    const definition = createSavedViewDefinition({
      ...completeView.definition,
      search: longSearch,
      page: 7,
    })
    const storage = new MemoryStorage()

    expect(definition).toEqual({
      ...completeView.definition,
      search: longSearch,
    })
    expect(persistSavedViews([{ ...completeView, definition }], storage)).toBe(
      true,
    )
    expect(loadSavedViews(storage).views[0]?.definition.search).toBe(longSearch)
  })

  it.each([
    '{not valid json',
    JSON.stringify({ version: 2, views: [] }),
    JSON.stringify({ version: 1, views: 'not-an-array' }),
  ])('ignores an unsafe saved-view envelope', (raw) => {
    const storage = new MemoryStorage()
    storage.setItem(SAVED_VIEWS_STORAGE_KEY, raw)

    expect(loadSavedViews(storage)).toEqual({
      views: [],
      issue: 'malformed',
    })
  })

  it('keeps valid siblings and normalizes stored filter values', () => {
    const storage = new MemoryStorage()
    storage.setItem(
      SAVED_VIEWS_STORAGE_KEY,
      JSON.stringify({
        version: 1,
        views: [
          completeView,
          { id: '', name: 'Broken', definition: completeView.definition },
          {
            id: 'view-2',
            name: '  Normalized queue  ',
            definition: {
              ...completeView.definition,
              statuses: ['resolved', 'new', 'resolved', 'unknown'],
              priorities: ['urgent', 'low', 'urgent', 'critical'],
            },
          },
        ],
      }),
    )

    const loaded = loadSavedViews(storage)
    expect(loaded.issue).toBe('malformed')
    expect(loaded.views).toHaveLength(2)
    expect(loaded.views[1]).toMatchObject({
      id: 'view-2',
      name: 'Normalized queue',
      definition: {
        statuses: ['new', 'resolved'],
        priorities: ['low', 'urgent'],
      },
    })
  })

  it('drops stored names that collide after display normalization', () => {
    const storage = new MemoryStorage()
    storage.setItem(
      SAVED_VIEWS_STORAGE_KEY,
      JSON.stringify({
        version: 1,
        views: [
          completeView,
          {
            ...completeView,
            id: 'view-2',
            name: '  urgent    BILLING  ',
          },
        ],
      }),
    )

    expect(loadSavedViews(storage)).toEqual({
      views: [completeView],
      issue: 'malformed',
    })
  })

  it('rejects stored names that exceed the supported boundary', () => {
    const storage = new MemoryStorage()
    storage.setItem(
      SAVED_VIEWS_STORAGE_KEY,
      JSON.stringify({
        version: 1,
        views: [
          {
            ...completeView,
            name: 'x'.repeat(61),
          },
        ],
      }),
    )

    expect(loadSavedViews(storage)).toEqual({
      views: [],
      issue: 'malformed',
    })
  })

  it('contains unavailable storage reads and writes', () => {
    const unavailableRead: StorageLike = {
      getItem() {
        throw new DOMException('Blocked', 'SecurityError')
      },
      setItem() {},
    }
    const unavailableWrite: StorageLike = {
      getItem() {
        return null
      },
      setItem() {
        throw new DOMException('Full', 'QuotaExceededError')
      },
    }

    expect(loadSavedViews(unavailableRead)).toEqual({
      views: [],
      issue: 'unavailable',
    })
    expect(persistSavedViews([completeView], unavailableWrite)).toBe(false)
  })

  it('chooses the first available deterministic local identifier', () => {
    expect(
      nextSavedViewId([
        completeView,
        { ...completeView, id: 'view-3', name: 'Another view' },
      ]),
    ).toBe('view-2')
  })
})
