import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { App } from './App'

describe('SignalDesk', () => {
  it('introduces the support workspace through an accessible heading', () => {
    render(<App />)

    expect(
      screen.getByRole('heading', { level: 1, name: 'SignalDesk' }),
    ).toBeInTheDocument()
    expect(
      screen.getByText(
        'A calm workspace for finding and resolving customer tickets.',
      ),
    ).toBeVisible()
  })
})
