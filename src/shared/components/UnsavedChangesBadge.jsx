const statusLabels = {
  unsaved: 'Unsaved changes',
  saving: 'Saving...',
  saved: 'Saved',
  error: 'Save failed'
};

export default function UnsavedChangesBadge({ state = 'saved', reminder = '' }) {
  const label = statusLabels[state];

  if (!label) {
    return null;
  }

  return (
    <div className={`save-status ${state} no-print`} role="status" aria-live="polite">
      <strong>{label}</strong>
      {reminder && <span>{reminder}</span>}
    </div>
  );
}
