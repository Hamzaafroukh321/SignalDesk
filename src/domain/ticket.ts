export const ticketStatuses = ['new', 'open', 'pending', 'resolved'] as const
export const ticketPriorities = ['low', 'normal', 'high', 'urgent'] as const

export type TicketStatus = (typeof ticketStatuses)[number]
export type TicketPriority = (typeof ticketPriorities)[number]
export type TicketId = `SD-${number}`

export interface Assignee {
  id: string
  name: string
  initials: string
}

export interface TicketTag {
  id: string
  label: string
}

export interface Customer {
  name: string
  email: string
}

export type ActivityKind = 'created' | 'status-change' | 'note'

export interface TicketActivity {
  id: string
  kind: ActivityKind
  message: string
  author: string
  createdAt: string
}

export interface Ticket {
  id: TicketId
  title: string
  customer: Customer
  status: TicketStatus
  priority: TicketPriority
  assignee: Assignee | null
  createdAt: string
  updatedAt: string
  tags: TicketTag[]
  description: string
  version: number
  activities: TicketActivity[]
}

const statusLabels: Record<TicketStatus, string> = {
  new: 'New',
  open: 'Open',
  pending: 'Pending',
  resolved: 'Resolved',
}

const priorityLabels: Record<TicketPriority, string> = {
  low: 'Low',
  normal: 'Normal',
  high: 'High',
  urgent: 'Urgent',
}

export function getStatusLabel(status: TicketStatus): string {
  return statusLabels[status]
}

export function getPriorityLabel(priority: TicketPriority): string {
  return priorityLabels[priority]
}

export function isTicketStatus(value: string): value is TicketStatus {
  return ticketStatuses.some((status) => status === value)
}

export function isTicketPriority(value: string): value is TicketPriority {
  return ticketPriorities.some((priority) => priority === value)
}
