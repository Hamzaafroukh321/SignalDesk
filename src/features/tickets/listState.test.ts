import { describe, expect, it } from 'vitest'
import {
  defaultTicketListState,
  parseTicketListState,
  serializeTicketListState,
} from './listState'

describe('ticket list URL state', () => {
  it('round-trips a complete canonical list state', () => {
    const state = {
      ...defaultTicketListState,
      search: 'annual invoice',
      statuses: ['new', 'open'] as const,
      priorities: ['high', 'urgent'] as const,
      sortBy: 'title' as const,
      sortDirection: 'asc' as const,
      page: 3,
      pageSize: 20 as const,
    }
    const serialized = serializeTicketListState({
      ...state,
      statuses: [...state.statuses],
      priorities: [...state.priorities],
    })

    expect(parseTicketListState(serialized)).toEqual({
      ...state,
      statuses: [...state.statuses],
      priorities: [...state.priorities],
    })
  })

  it('normalizes invalid and duplicate parameters safely', () => {
    expect(
      parseTicketListState(
        '?status=bogus&status=open&status=open&priority=nope&sort=random&dir=sideways&page=-4',
      ),
    ).toEqual({
      ...defaultTicketListState,
      statuses: ['open'],
    })
  })

  it('omits default values from a clean shareable URL', () => {
    expect(serializeTicketListState(defaultTicketListState)).toBe('')
  })

  it('normalizes an unsupported page size', () => {
    expect(parseTicketListState('?size=17').pageSize).toBe(10)
    expect(parseTicketListState('?size=1e1').pageSize).toBe(10)
    expect(parseTicketListState('?size=0x14').pageSize).toBe(10)
    expect(parseTicketListState('?size=020').pageSize).toBe(10)
    expect(parseTicketListState('?size=5').pageSize).toBe(5)
    expect(parseTicketListState('?size=20').pageSize).toBe(20)
  })
})
