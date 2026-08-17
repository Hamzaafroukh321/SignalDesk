import { describe, expect, it } from 'vitest'
import {
  getPriorityLabel,
  getStatusLabel,
  isTicketPriority,
  isTicketStatus,
} from './ticket'

describe('ticket domain helpers', () => {
  it('labels known status and priority values', () => {
    expect(getStatusLabel('pending')).toBe('Pending')
    expect(getPriorityLabel('urgent')).toBe('Urgent')
  })

  it('narrows only supported status and priority strings', () => {
    expect(isTicketStatus('resolved')).toBe(true)
    expect(isTicketStatus('closed')).toBe(false)
    expect(isTicketPriority('high')).toBe(true)
    expect(isTicketPriority('critical')).toBe(false)
  })
})
