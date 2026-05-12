export default function WorkLogSection({
  appendWorkLog,
  draftJob,
  removeWorkLogEntry,
  saveWorkLogChanges,
  setWorkLogText,
  updateWorkLogEntry,
  workLogText
}) {
  return (
    <section>
      <h3>Work Log</h3>
      <form className="row-form" onSubmit={appendWorkLog}>
        <textarea value={workLogText} onChange={(event) => setWorkLogText(event.target.value)} rows="3" />
        <button type="submit">Append Entry</button>
      </form>
      <div className="entries">
        {draftJob.workLog.map((entry) => (
          <div key={entry.id} className="entry">
            <time>{new Date(entry.timestamp).toLocaleString()}</time>
            <textarea
              value={entry.text}
              onChange={(event) => updateWorkLogEntry(entry.id, event.target.value)}
              onBlur={saveWorkLogChanges}
              rows="3"
            />
            <button type="button" className="entry-delete no-print" onClick={() => removeWorkLogEntry(entry.id)}>
              Delete Entry
            </button>
          </div>
        ))}
      </div>
    </section>
  );
}
