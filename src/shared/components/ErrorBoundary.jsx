import { Component } from 'react';
import { getErrorMessage, logLegacyDebug } from '../legacy/legacyDebug';

export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    console.error('FretTrack render failed.', error, info);
    logLegacyDebug('caught render error', getErrorMessage(error));
  }

  render() {
    if (this.state.error) {
      return (
        <main className="app auth-shell">
          <section className="panel auth-panel">
            <h1>FretTrack</h1>
            <p>FretTrack could not finish loading in this browser.</p>
            <p className="muted-text">
              Try refreshing the page. If this is an older iPad, try Safari on a newer iOS/iPadOS device or desktop.
            </p>
          </section>
        </main>
      );
    }

    return this.props.children;
  }
}
