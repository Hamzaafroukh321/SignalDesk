import { createTicketFixtures } from './ticketFixtures'
import type {
  Assignee,
  Ticket,
  TicketId,
  TicketPriority,
  TicketStatus,
  TicketTag,
} from '../domain/ticket'

export type RepositoryOperation =
  | 'listTickets'
  | 'getTicket'
  | 'updateTicket'
  | 'bulkUpdateStatus'
  | 'addTicketNote'

export type TicketSortField = 'updatedAt' | 'priority' | 'status' | 'title'
export type SortDirection = 'asc' | 'desc'

export interface ListTicketsQuery {
  search?: string
  statuses?: readonly TicketStatus[]
  priorities?: readonly TicketPriority[]
  sortBy?: TicketSortField
  sortDirection?: SortDirection
  page?: number
  pageSize?: number
}

export interface NormalizedListTicketsQuery {
  search: string
  statuses: readonly TicketStatus[]
  priorities: readonly TicketPriority[]
  sortBy: TicketSortField
  sortDirection: SortDirection
  page: number
  pageSize: number
}

export interface TicketListPage {
  tickets: Ticket[]
  totalCount: number
  totalPages: number
  page: number
  pageSize: number
  query: NormalizedListTicketsQuery
}

export type TicketChanges = Partial<
  Pick<
    Ticket,
    'title' | 'status' | 'priority' | 'assignee' | 'description' | 'tags'
  >
>

export interface UpdateTicketCommand {
  id: TicketId
  expectedVersion: number
  changes: TicketChanges
}

export interface VersionedTicketTarget {
  id: TicketId
  expectedVersion: number
}

export interface BulkUpdateStatusCommand {
  targets: readonly VersionedTicketTarget[]
  status: TicketStatus
}

export interface BulkUpdateStatusResult {
  tickets: Ticket[]
  updatedIds: TicketId[]
}

export interface AddTicketNoteCommand {
  id: TicketId
  expectedVersion: number
  body: string
}

export interface RepositoryRequestOptions {
  signal?: AbortSignal
}

export interface OperationPlan {
  latencyMs?: number
  fault?: {
    message?: string
  }
}

export interface TicketRepositoryOptions {
  initialTickets?: readonly Ticket[]
  defaultLatencyMs?: number
  plans?: Partial<Record<RepositoryOperation, readonly OperationPlan[]>>
  now?: () => string
}

export interface TicketRepository {
  listTickets(
    query?: ListTicketsQuery,
    options?: RepositoryRequestOptions,
  ): Promise<TicketListPage>
  getTicket(id: TicketId, options?: RepositoryRequestOptions): Promise<Ticket>
  updateTicket(
    command: UpdateTicketCommand,
    options?: RepositoryRequestOptions,
  ): Promise<Ticket>
  bulkUpdateStatus(
    command: BulkUpdateStatusCommand,
    options?: RepositoryRequestOptions,
  ): Promise<BulkUpdateStatusResult>
  addTicketNote(
    command: AddTicketNoteCommand,
    options?: RepositoryRequestOptions,
  ): Promise<Ticket>
}

export type TicketRepositoryErrorCode =
  | 'NOT_FOUND'
  | 'VERSION_CONFLICT'
  | 'VALIDATION'
  | 'UNAVAILABLE'

export class TicketRepositoryError extends Error {
  constructor(
    message: string,
    readonly code: TicketRepositoryErrorCode,
  ) {
    super(message)
    this.name = 'TicketRepositoryError'
  }
}

export class TicketVersionConflictError extends TicketRepositoryError {
  readonly currentTicket: Ticket

  constructor(
    readonly expectedVersion: number,
    currentTicket: Ticket,
  ) {
    super(
      `Ticket ${currentTicket.id} changed from version ${expectedVersion} to ${currentTicket.version}.`,
      'VERSION_CONFLICT',
    )
    this.name = 'TicketVersionConflictError'
    this.currentTicket = cloneTicket(currentTicket)
  }
}

const priorityRank: Record<TicketPriority, number> = {
  low: 0,
  normal: 1,
  high: 2,
  urgent: 3,
}

const statusRank: Record<TicketStatus, number> = {
  new: 0,
  open: 1,
  pending: 2,
  resolved: 3,
}

function cloneAssignee(assignee: Assignee | null): Assignee | null {
  return assignee ? { ...assignee } : null
}

function cloneTags(tags: readonly TicketTag[]): TicketTag[] {
  return tags.map((tag) => ({ ...tag }))
}

export function cloneTicket(ticket: Ticket): Ticket {
  return {
    ...ticket,
    customer: { ...ticket.customer },
    assignee: cloneAssignee(ticket.assignee),
    tags: cloneTags(ticket.tags),
    activities: ticket.activities.map((activity) => ({ ...activity })),
  }
}

function cloneChanges(changes: TicketChanges): TicketChanges {
  const clone: TicketChanges = {}

  if (changes.title !== undefined) clone.title = changes.title
  if (changes.status !== undefined) clone.status = changes.status
  if (changes.priority !== undefined) clone.priority = changes.priority
  if (changes.description !== undefined) clone.description = changes.description
  if (Object.hasOwn(changes, 'assignee')) {
    clone.assignee = cloneAssignee(changes.assignee ?? null)
  }
  if (changes.tags !== undefined) clone.tags = cloneTags(changes.tags)

  return clone
}

function waitForLatency(latencyMs: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(new DOMException('The repository request was aborted.', 'AbortError'))
      return
    }

    const handleAbort = () => {
      clearTimeout(timer)
      reject(new DOMException('The repository request was aborted.', 'AbortError'))
    }
    const timer = setTimeout(() => {
      signal?.removeEventListener('abort', handleAbort)
      resolve()
    }, Math.max(0, latencyMs))

    signal?.addEventListener('abort', handleAbort, { once: true })
  })
}

function compareText(left: string, right: string): number {
  const normalizedLeft = left.toLocaleLowerCase('en-US')
  const normalizedRight = right.toLocaleLowerCase('en-US')
  return normalizedLeft < normalizedRight
    ? -1
    : normalizedLeft > normalizedRight
      ? 1
      : 0
}

function normalizePositiveInteger(value: number | undefined, fallback: number) {
  return Number.isFinite(value) && value && value > 0
    ? Math.floor(value)
    : fallback
}

function normalizeQuery(query: ListTicketsQuery): NormalizedListTicketsQuery {
  return {
    search: query.search?.trim() ?? '',
    statuses: [...(query.statuses ?? [])],
    priorities: [...(query.priorities ?? [])],
    sortBy: query.sortBy ?? 'updatedAt',
    sortDirection: query.sortDirection ?? 'desc',
    page: normalizePositiveInteger(query.page, 1),
    pageSize: Math.min(normalizePositiveInteger(query.pageSize, 10), 100),
  }
}

function compareTickets(
  left: Ticket,
  right: Ticket,
  sortBy: TicketSortField,
  direction: SortDirection,
): number {
  let result = 0

  if (sortBy === 'updatedAt') result = compareText(left.updatedAt, right.updatedAt)
  if (sortBy === 'title') result = compareText(left.title, right.title)
  if (sortBy === 'priority') {
    result = priorityRank[left.priority] - priorityRank[right.priority]
  }
  if (sortBy === 'status') {
    result = statusRank[left.status] - statusRank[right.status]
  }

  if (result !== 0) return direction === 'asc' ? result : -result
  return compareText(left.id, right.id)
}

function matchesQuery(ticket: Ticket, query: NormalizedListTicketsQuery) {
  const search = query.search.toLocaleLowerCase('en-US')
  const searchableText = [
    ticket.id,
    ticket.title,
    ticket.customer.name,
    ...ticket.tags.map((tag) => tag.label),
  ]
    .join(' ')
    .toLocaleLowerCase('en-US')

  return (
    (!search || searchableText.includes(search)) &&
    (!query.statuses.length || query.statuses.includes(ticket.status)) &&
    (!query.priorities.length || query.priorities.includes(ticket.priority))
  )
}

function editableFieldsMatch(left: Ticket, right: Ticket): boolean {
  return (
    left.title === right.title &&
    left.status === right.status &&
    left.priority === right.priority &&
    left.description === right.description &&
    left.assignee?.id === right.assignee?.id &&
    left.tags.length === right.tags.length &&
    left.tags.every((tag, index) => tag.id === right.tags[index]?.id)
  )
}

export function isAbortError(error: unknown): boolean {
  return error instanceof DOMException && error.name === 'AbortError'
}

export function isTicketRepositoryError(
  error: unknown,
): error is TicketRepositoryError {
  return error instanceof TicketRepositoryError
}

export function createTicketRepository(
  options: TicketRepositoryOptions = {},
): TicketRepository {
  const store = new Map<TicketId, Ticket>(
    (options.initialTickets ?? createTicketFixtures()).map((ticket) => [
      ticket.id,
      cloneTicket(ticket),
    ]),
  )
  const operationCalls = new Map<RepositoryOperation, number>()
  let clockTick = 0
  const nextTimestamp =
    options.now ??
    (() => {
      clockTick += 1
      return new Date(
        Date.parse('2026-08-15T12:00:00.000Z') + clockTick * 60_000,
      ).toISOString()
    })

  function nextPlan(operation: RepositoryOperation): OperationPlan {
    const callIndex = operationCalls.get(operation) ?? 0
    operationCalls.set(operation, callIndex + 1)
    return options.plans?.[operation]?.[callIndex] ?? {}
  }

  async function execute<T>(
    operation: RepositoryOperation,
    signal: AbortSignal | undefined,
    work: () => T,
  ): Promise<T> {
    const plan = nextPlan(operation)
    await waitForLatency(plan.latencyMs ?? options.defaultLatencyMs ?? 180, signal)
    if (plan.fault) {
      throw new TicketRepositoryError(
        plan.fault.message ?? 'SignalDesk is temporarily unavailable.',
        'UNAVAILABLE',
      )
    }
    return work()
  }

  function requireTicket(id: TicketId): Ticket {
    const ticket = store.get(id)
    if (!ticket) {
      throw new TicketRepositoryError(`Ticket ${id} was not found.`, 'NOT_FOUND')
    }
    return ticket
  }

  function requireVersion(ticket: Ticket, expectedVersion: number) {
    if (ticket.version !== expectedVersion) {
      throw new TicketVersionConflictError(expectedVersion, ticket)
    }
  }

  return {
    listTickets(query = {}, requestOptions = {}) {
      const normalizedQuery = normalizeQuery(query)
      return execute('listTickets', requestOptions.signal, () => {
        const matchingTickets = [...store.values()]
          .filter((ticket) => matchesQuery(ticket, normalizedQuery))
          .sort((left, right) =>
            compareTickets(
              left,
              right,
              normalizedQuery.sortBy,
              normalizedQuery.sortDirection,
            ),
          )
        const totalCount = matchingTickets.length
        const totalPages = Math.max(1, Math.ceil(totalCount / normalizedQuery.pageSize))
        const page = Math.min(normalizedQuery.page, totalPages)
        const start = (page - 1) * normalizedQuery.pageSize

        return {
          tickets: matchingTickets
            .slice(start, start + normalizedQuery.pageSize)
            .map(cloneTicket),
          totalCount,
          totalPages,
          page,
          pageSize: normalizedQuery.pageSize,
          query: { ...normalizedQuery, page },
        }
      })
    },

    getTicket(id, requestOptions = {}) {
      const capturedId = id
      return execute('getTicket', requestOptions.signal, () =>
        cloneTicket(requireTicket(capturedId)),
      )
    },

    updateTicket(command, requestOptions = {}) {
      const capturedCommand = {
        ...command,
        changes: cloneChanges(command.changes),
      }
      return execute('updateTicket', requestOptions.signal, () => {
        const current = requireTicket(capturedCommand.id)
        requireVersion(current, capturedCommand.expectedVersion)

        const proposed: Ticket = {
          ...cloneTicket(current),
          ...capturedCommand.changes,
          assignee: Object.hasOwn(capturedCommand.changes, 'assignee')
            ? cloneAssignee(capturedCommand.changes.assignee ?? null)
            : cloneAssignee(current.assignee),
          tags: capturedCommand.changes.tags
            ? cloneTags(capturedCommand.changes.tags)
            : cloneTags(current.tags),
        }

        if (!proposed.title.trim() || !proposed.description.trim()) {
          throw new TicketRepositoryError(
            'A ticket title and description are required.',
            'VALIDATION',
          )
        }

        if (editableFieldsMatch(current, proposed)) return cloneTicket(current)

        const nextVersion = current.version + 1
        const updatedAt = nextTimestamp()
        const activities = [...current.activities.map((activity) => ({ ...activity }))]
        if (current.status !== proposed.status) {
          activities.push({
            id: `${current.id}-status-v${nextVersion}`,
            kind: 'status-change',
            message: `Status moved from ${current.status} to ${proposed.status}.`,
            author: 'Support team',
            createdAt: updatedAt,
          })
        }

        const updated: Ticket = {
          ...proposed,
          version: nextVersion,
          updatedAt,
          activities,
        }
        store.set(updated.id, cloneTicket(updated))
        return cloneTicket(updated)
      })
    },

    bulkUpdateStatus(command, requestOptions = {}) {
      const capturedCommand = {
        status: command.status,
        targets: command.targets.map((target) => ({ ...target })),
      }
      return execute('bulkUpdateStatus', requestOptions.signal, () => {
        const targetIds = capturedCommand.targets.map((target) => target.id)
        if (!targetIds.length || new Set(targetIds).size !== targetIds.length) {
          throw new TicketRepositoryError(
            'Bulk updates require unique ticket targets.',
            'VALIDATION',
          )
        }

        const currentTickets = capturedCommand.targets.map((target) => {
          const ticket = requireTicket(target.id)
          requireVersion(ticket, target.expectedVersion)
          return ticket
        })
        const changedTickets = currentTickets.filter(
          (ticket) => ticket.status !== capturedCommand.status,
        )
        const sharedTimestamp = changedTickets.length ? nextTimestamp() : null
        const updatedIds: TicketId[] = []

        const tickets = currentTickets.map((ticket) => {
          if (!sharedTimestamp || ticket.status === capturedCommand.status) {
            return cloneTicket(ticket)
          }
          const nextVersion = ticket.version + 1
          const updated: Ticket = {
            ...cloneTicket(ticket),
            status: capturedCommand.status,
            version: nextVersion,
            updatedAt: sharedTimestamp,
            activities: [
              ...ticket.activities.map((activity) => ({ ...activity })),
              {
                id: `${ticket.id}-status-v${nextVersion}`,
                kind: 'status-change',
                message: `Status moved from ${ticket.status} to ${capturedCommand.status}.`,
                author: 'Support team',
                createdAt: sharedTimestamp,
              },
            ],
          }
          store.set(updated.id, cloneTicket(updated))
          updatedIds.push(updated.id)
          return cloneTicket(updated)
        })

        return { tickets, updatedIds }
      })
    },

    addTicketNote(command, requestOptions = {}) {
      const capturedCommand = { ...command, body: command.body.trim() }
      return execute('addTicketNote', requestOptions.signal, () => {
        if (!capturedCommand.body) {
          throw new TicketRepositoryError(
            'A note cannot be empty.',
            'VALIDATION',
          )
        }
        const current = requireTicket(capturedCommand.id)
        requireVersion(current, capturedCommand.expectedVersion)
        const nextVersion = current.version + 1
        const createdAt = nextTimestamp()
        const updated: Ticket = {
          ...cloneTicket(current),
          version: nextVersion,
          updatedAt: createdAt,
          activities: [
            ...current.activities.map((activity) => ({ ...activity })),
            {
              id: `${current.id}-note-v${nextVersion}`,
              kind: 'note',
              message: capturedCommand.body,
              author: 'Support team',
              createdAt,
            },
          ],
        }
        store.set(updated.id, cloneTicket(updated))
        return cloneTicket(updated)
      })
    },
  }
}
