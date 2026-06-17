import React from 'react';
import { createRoot } from 'react-dom/client';
import './shared/legacy/legacyBrowserSupport';
import AppBootstrap from './app/AppBootstrap.jsx';
import ErrorBoundary from './shared/components/ErrorBoundary.jsx';
import './styles.css';
import { registerPwaServiceWorker } from './shared/pwa/pwaSupport';

registerPwaServiceWorker();

createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <ErrorBoundary>
      <AppBootstrap />
    </ErrorBoundary>
  </React.StrictMode>
);
