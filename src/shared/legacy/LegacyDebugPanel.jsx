import { useEffect, useState } from 'react';
import { getLegacyDebugEntries, isLegacyDebugEnabled, subscribeLegacyDebug } from './legacyDebug';

export default function LegacyDebugPanel() {
  const [entries, setEntries] = useState(() => getLegacyDebugEntries());

  useEffect(() => subscribeLegacyDebug(setEntries), []);

  if (!isLegacyDebugEnabled()) {
    return null;
  }

  return (
    <aside className="legacy-debug-panel" aria-live="polite">
      <h2>Legacy Debug</h2>
      <ol>
        {entries.map((entry) => (
          <li key={entry.id}>
            <strong>{entry.message}</strong>
            {entry.detail && <span>{entry.detail}</span>}
            {entry.timestamp && <small>{entry.timestamp}</small>}
          </li>
        ))}
      </ol>
    </aside>
  );
}
