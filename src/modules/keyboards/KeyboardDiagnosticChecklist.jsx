import {
  KEYBOARD_CHECKLIST_STATUSES,
  KEYBOARD_DIAGNOSTIC_CHECKLISTS,
  normalizeKeyboardChecklist
} from './keyboardDiagnostics.js';

export default function KeyboardDiagnosticChecklist({ keyboard, canWrite, onChange }) {
  const checklist = normalizeKeyboardChecklist(keyboard.diagnosticChecklist, keyboard.keyboardType);
  const definition = KEYBOARD_DIAGNOSTIC_CHECKLISTS[checklist.templateKey];

  function selectTemplate(event) {
    onChange(normalizeKeyboardChecklist({ templateKey: event.target.value }, keyboard.keyboardType));
  }

  function updateItem(itemId, field, value) {
    onChange({
      ...checklist,
      items: {
        ...checklist.items,
        [itemId]: { ...checklist.items[itemId], [field]: value }
      }
    });
  }

  return (
    <section className="panel keyboard-checklist-panel">
      <div className="panel-heading">
        <div>
          <h3>Guided Diagnostic Checklist</h3>
          <p className="muted-text">A repeatable bench path based on the instrument family; add model-specific observations beside each step.</p>
        </div>
        <label>
          Diagnostic Path
          <select value={checklist.templateKey} onChange={selectTemplate} disabled={!canWrite}>
            {Object.entries(KEYBOARD_DIAGNOSTIC_CHECKLISTS).map(([key, item]) => <option key={key} value={key}>{item.label}</option>)}
          </select>
        </label>
      </div>
      <div className="keyboard-checklist-items">
        {definition.items.map(([itemId, label], index) => (
          <div className="keyboard-checklist-item" key={itemId}>
            <span className="keyboard-checklist-number">{index + 1}</span>
            <label className="keyboard-checklist-step">
              <strong>{label}</strong>
              <input
                value={checklist.items[itemId]?.notes || ''}
                onChange={(event) => updateItem(itemId, 'notes', event.target.value)}
                disabled={!canWrite}
                placeholder="Model-specific finding or measurement"
              />
            </label>
            <select
              aria-label={`${label} status`}
              value={checklist.items[itemId]?.status || 'Not checked'}
              onChange={(event) => updateItem(itemId, 'status', event.target.value)}
              disabled={!canWrite}
            >
              {KEYBOARD_CHECKLIST_STATUSES.map((status) => <option key={status}>{status}</option>)}
            </select>
          </div>
        ))}
      </div>
    </section>
  );
}
