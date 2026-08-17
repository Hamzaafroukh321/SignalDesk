import { useState } from 'react'
import type { MouseEvent } from 'react'
import {
  createTicketRepository,
  type TicketRepository,
} from './data/ticketRepository'
import { AnnouncementProvider } from './components/AnnouncementProvider'
import { TicketWorkspace } from './features/tickets/TicketWorkspace'

interface AppProps {
  repository?: TicketRepository
}

export function App({ repository }: AppProps) {
  const [ticketRepository] = useState(
    () => repository ?? createTicketRepository(),
  )
  const focusMainContent = (event: MouseEvent<HTMLAnchorElement>) => {
    event.preventDefault()
    document.getElementById('main-content')?.focus()
  }

  return (
    <AnnouncementProvider>
      <div className="app-shell">
        <a className="skip-link" href="#main-content" onClick={focusMainContent}>
          Skip to ticket workspace
        </a>

        <header className="site-header">
          <a className="wordmark" href="/" aria-label="SignalDesk home">
            <span aria-hidden="true" className="wordmark-mark">
              S
            </span>
            <span>SignalDesk</span>
          </a>
          <p>Support operations</p>
        </header>

        <main id="main-content" className="workspace" tabIndex={-1}>
          <section className="intro" aria-labelledby="page-title">
            <p className="eyebrow">Queue intelligence</p>
            <h1 id="page-title">Turn support signals into clear next steps.</h1>
            <p className="intro-copy">
              SignalDesk brings every customer request into one calm workspace
              so support teams can find what matters, coordinate ownership, and
              act with confidence.
            </p>
          </section>

          <div className="workspace-grid">
            <TicketWorkspace repository={ticketRepository} />
          </div>
        </main>
      </div>
    </AnnouncementProvider>
  )
}
