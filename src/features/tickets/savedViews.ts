import {
  isTicketPriority,
  isTicketStatus,
  ticketPriorities,
  ticketStatuses,
  type TicketPriority,
  type TicketStatus,
} from '../../domain/ticket'
import type {
  SortDirection,
  TicketSortField,
} from '../../data/ticketRepository'
import {
  ticketPageSizes,
  type TicketListState,
  type TicketPageSize,
} from './listState'

export const SAVED_VIEWS_STORAGE_KEY = 'signaldesk.savedViews'
export const MAX_SAVED_VIEW_NAME_LENGTH = 60

export interface SavedViewDefinition {
  search: string
  statuses: TicketStatus[]
  priorities: TicketPriority[]
  sortBy: TicketSortField
  sortDirection: SortDirection
  pageSize: TicketPageSize
}

export interface SavedView {
  id: string
  name: string
  definition: SavedViewDefinition
}

export interface StorageLike {
  getItem(key: string): string | null
  setItem(key: string, value: string): void
}

export interface SavedViewLoadResult {
  views: SavedView[]
  issue: 'malformed' | 'unavailable' | null
}

interface SavedViewsEnvelope {
  version: 1
  views: SavedView[]
}

const sortFields: readonly TicketSortField[] = [
  'updatedAt',
  'priority',
  'status',
  'title',
]

export function normalizeSavedViewName(value: string) {
  return value.trim().replace(/\s+/g, ' ')
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isSortField(value: unknown): value is TicketSortField {
  return (
    typeof value === 'string' &&
    sortFields.some((sortField) => sortField === value)
  )
}

function isSortDirection(value: unknown): value is SortDirection {
  return value === 'asc' || value === 'desc'
}

function isPageSize(value: unknown): value is TicketPageSize {
  return (
    typeof value === 'number' &&
    ticketPageSizes.some((pageSize) => pageSize === value)
  )
}

function normalizeDefinition(value: unknown): SavedViewDefinition | null {
  if (
    !isRecord(value) ||
    typeof value.search !== 'string' ||
    !Array.isArray(value.statuses) ||
    !Array.isArray(value.priorities) ||
    !isSortField(value.sortBy) ||
    !isSortDirection(value.sortDirection) ||
    !isPageSize(value.pageSize)
  ) {
    return null
  }

  const requestedStatuses = value.statuses.filter(
    (status): status is TicketStatus =>
      typeof status === 'string' && isTicketStatus(status),
  )
  const requestedPriorities = value.priorities.filter(
    (priority): priority is TicketPriority =>
      typeof priority === 'string' && isTicketPriority(priority),
  )

  return {
    search: value.search,
    statuses: ticketStatuses.filter((status) =>
      requestedStatuses.includes(status),
    ),
    priorities: ticketPriorities.filter((priority) =>
      requestedPriorities.includes(priority),
    ),
    sortBy: value.sortBy,
    sortDirection: value.sortDirection,
    pageSize: value.pageSize,
  }
}

function normalizeView(value: unknown): SavedView | null {
  if (
    !isRecord(value) ||
    typeof value.id !== 'string' ||
    typeof value.name !== 'string'
  ) {
    return null
  }
  const id = value.id.trim()
  const name = normalizeSavedViewName(value.name)
  const definition = normalizeDefinition(value.definition)
  if (
    !id ||
    id.length > 80 ||
    !name ||
    name.length > MAX_SAVED_VIEW_NAME_LENGTH ||
    !definition
  ) {
    return null
  }
  return { id, name, definition }
}

function resolveStorage(storage?: StorageLike) {
  return storage ?? window.localStorage
}

export function loadSavedViews(storage?: StorageLike): SavedViewLoadResult {
  try {
    const raw = resolveStorage(storage).getItem(SAVED_VIEWS_STORAGE_KEY)
    if (raw === null) return { views: [], issue: null }
    const parsed: unknown = JSON.parse(raw)
    if (!isRecord(parsed) || parsed.version !== 1 || !Array.isArray(parsed.views)) {
      return { views: [], issue: 'malformed' }
    }

    const seenIds = new Set<string>()
    const seenNames = new Set<string>()
    const views = parsed.views.flatMap((value) => {
      const view = normalizeView(value)
      if (!view) return []
      const nameKey = view.name.toLowerCase()
      if (seenIds.has(view.id) || seenNames.has(nameKey)) return []
      seenIds.add(view.id)
      seenNames.add(nameKey)
      return [view]
    })
    return {
      views,
      issue: views.length === parsed.views.length ? null : 'malformed',
    }
  } catch (error) {
    return {
      views: [],
      issue: error instanceof SyntaxError ? 'malformed' : 'unavailable',
    }
  }
}

export function persistSavedViews(
  views: readonly SavedView[],
  storage?: StorageLike,
) {
  const envelope: SavedViewsEnvelope = {
    version: 1,
    views: views.map((view) => ({
      id: view.id,
      name: view.name,
      definition: {
        ...view.definition,
        statuses: [...view.definition.statuses],
        priorities: [...view.definition.priorities],
      },
    })),
  }
  try {
    resolveStorage(storage).setItem(
      SAVED_VIEWS_STORAGE_KEY,
      JSON.stringify(envelope),
    )
    return true
  } catch {
    return false
  }
}

export function createSavedViewDefinition(
  state: TicketListState,
): SavedViewDefinition {
  return {
    search: state.search,
    statuses: [...state.statuses],
    priorities: [...state.priorities],
    sortBy: state.sortBy,
    sortDirection: state.sortDirection,
    pageSize: state.pageSize,
  }
}

export function nextSavedViewId(views: readonly SavedView[]) {
  let suffix = 1
  const ids = new Set(views.map((view) => view.id))
  while (ids.has(`view-${suffix}`)) suffix += 1
  return `view-${suffix}`
}
