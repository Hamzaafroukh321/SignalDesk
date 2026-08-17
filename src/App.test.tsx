import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { App } from './App'

describe('SignalDesk application shell', () => {
  it('provides the landmarks and context for the ticket workspace', () => {
    render(<App />)

    expect(screen.getByRole('banner')).toBeInTheDocument()
    expect(screen.getByRole('main')).toBeInTheDocument()
    expect(
      screen.getByRole('heading', {
        level: 1,
        name: 'Turn support signals into clear next steps.',
      }),
    ).toBeVisible()
    expect(
      screen.getByRole('region', { name: 'Ticket controls' }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('region', { name: 'Ticket results' }),
    ).toBeInTheDocument()
    expect(screen.getByRole('status')).toHaveTextContent(
      'SignalDesk is ready for the queue.',
    )
  })

  it('moves keyboard focus to the main workspace through the skip link', async () => {
    const user = userEvent.setup()
    render(<App />)

    const skipLink = screen.getByRole('link', {
      name: 'Skip to ticket workspace',
    })
    await user.click(skipLink)

    expect(screen.getByRole('main')).toHaveFocus()
  })
})
