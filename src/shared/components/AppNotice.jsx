export default function AppNotice({ message, type = 'success', onDismiss }) {
  if (!message) {
    return null;
  }

  return (
    <div className={`app-notice no-print ${type}`} role={type === 'error' ? 'alert' : 'status'}>
      <span>{message}</span>
      {onDismiss && (
        <button type="button" className="app-notice-dismiss" onClick={onDismiss} aria-label="Dismiss notice">
          x
        </button>
      )}
    </div>
  );
}
