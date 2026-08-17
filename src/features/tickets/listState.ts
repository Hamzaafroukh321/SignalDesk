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

export interface TicketListState {
  search: string
  statuses: TicketStatus[]
  priorities: TicketPriority[]
  sortBy: TicketSortField
  sortDirection: SortDirection
  page: number
  pageSize: number
}

export const defaultTicketListState: TicketListState = {
  search: '',
  statuses: [],
  priorities: [],
  sortBy: 'updatedAt',
  sortDirection: 'desc',
  page: 1,
  pageSize: 10,
}

const sortFields: readonly TicketSortField[] = [
  'updatedAt',
  'priority',
  'status',
  'title',
]

function isSortField(value: string): value is TicketSortField {
  return sortFields.some((field) => field === value)
}

function parsePage(value: string | null): number {
  if (!value || !/^\d+$/.test(value)) return 1
  const page = Number(value)
  return Number.isSafeInteger(page) && page > 0 ? page : 1
}

export function parseTicketListState(search: string): TicketListState {
  const parameters = new URLSearchParams(search)
  const requestedStatuses = parameters
    .getAll('status')
    .filter(isTicketStatus)
  const requestedPriorities = parameters
    .getAll('priority')
    .filter(isTicketPriority)
  const requestedSort = parameters.get('sort') ?? ''
  const requestedDirection = parameters.get('dir')

  return {
    search: parameters.get('q') ?? '',
    statuses: ticketStatuses.filter((status) =>
      requestedStatuses.includes(status),
    ),
    priorities: ticketPriorities.filter((priority) =>
      requestedPriorities.includes(priority),
    ),
    sortBy: isSortField(requestedSort) ? requestedSort : 'updatedAt',
    sortDirection:
      requestedDirection === 'asc' || requestedDirection === 'desc'
        ? requestedDirection
        : 'desc',
    page: parsePage(parameters.get('page')),
    pageSize: 10,
  }
}

export function serializeTicketListState(state: TicketListState): string {
  const parameters = new URLSearchParams()
  if (state.search) parameters.set('q', state.search)
  state.statuses.forEach((status) => parameters.append('status', status))
  state.priorities.forEach((priority) =>
    parameters.append('priority', priority),
  )
  if (state.sortBy !== 'updatedAt') parameters.set('sort', state.sortBy)
  if (state.sortDirection !== 'desc') {
    parameters.set('dir', state.sortDirection)
  }
  if (state.page > 1) parameters.set('page', String(state.page))

  const query = parameters.toString()
  return query ? `?${query}` : ''
}

export function writeTicketListUrl(
  state: TicketListState,
  mode: 'push' | 'replace',
) {
  const url = `${window.location.pathname}${serializeTicketListState(state)}${window.location.hash}`
  if (mode === 'push') window.history.pushState(null, '', url)
  else window.history.replaceState(null, '', url)
}
