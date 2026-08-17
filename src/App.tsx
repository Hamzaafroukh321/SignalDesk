import type { MouseEvent } from 'react'

export function App() {
  const focusMainContent = (event: MouseEvent<HTMLAnchorElement>) => {
    event.preventDefault()
    document.getElementById('main-content')?.focus()
  }

  return (
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
            SignalDesk brings every customer request into one calm workspace so
            support teams can find what matters, coordinate ownership, and act
            with confidence.
          </p>
        </section>

        <div className="workspace-grid">
          <section className="panel controls-panel" aria-labelledby="controls-title">
            <div>
              <p className="panel-kicker">Refine the queue</p>
              <h2 id="controls-title">Ticket controls</h2>
            </div>
            <p>Search and filtering controls will appear here.</p>
          </section>

          <section className="panel results-panel" aria-labelledby="results-title">
            <div>
              <p className="panel-kicker">Shared focus</p>
              <h2 id="results-title">Ticket results</h2>
            </div>
            <p>The team ticket queue will appear here.</p>
          </section>
        </div>

        <section className="status-area" aria-labelledby="status-title">
          <h2 id="status-title" className="visually-hidden">
            Workspace updates
          </h2>
          <p role="status" aria-live="polite" aria-atomic="true">
            SignalDesk is ready for the queue.
          </p>
        </section>
      </main>
    </div>
  )
}
