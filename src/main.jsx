import React from 'react';
import { createRoot } from 'react-dom/client';
import './shared/legacy/legacyBrowserSupport';
import AppBootstrap from './app/AppBootstrap.jsx';
import ErrorBoundary from './shared/components/ErrorBoundary.jsx';
import './styles/foundations.css';
import './styles/workspace.css';
import './styles.css';
import './styles/professional-ui.css';
import { registerPwaServiceWorker } from './shared/pwa/pwaSupport';
import { installVitePreloadRecovery } from './shared/pwa/preloadRecovery';

installVitePreloadRecovery();
registerPwaServiceWorker();

createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <ErrorBoundary>
      <AppBootstrap />
    </ErrorBoundary>
  </React.StrictMode>
);
