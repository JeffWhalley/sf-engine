import { Component, type ReactNode } from 'react';

/**
 * Last-resort guard: render errors show a recoverable message instead of a
 * blank page. State problems can be cleared without losing the library.
 */
export class ErrorBoundary extends Component<
  { children: ReactNode },
  { error: Error | null }
> {
  state = { error: null as Error | null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div className="mx-auto max-w-xl px-6 py-16 text-center">
        <h1 className="font-display text-lg uppercase tracking-widest text-warn">
          Something broke
        </h1>
        <p className="mt-2 font-mono text-[12px] text-ink-3">{String(this.state.error)}</p>
        <button
          onClick={() => this.setState({ error: null })}
          className="mt-4 rounded bg-accent/20 px-4 py-1.5 font-display text-[12px] uppercase tracking-wider text-accent"
        >
          Try again
        </button>
        <p className="mt-3 font-mono text-[10px] text-ink-3">
          If it keeps happening, use Library → Export first, then reload the page.
        </p>
      </div>
    );
  }
}
