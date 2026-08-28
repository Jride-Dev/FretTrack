import { isAmplifierJob } from '../modules/amplifiers/amplifierRepair.js';
import { isKeyboardJob } from '../modules/keyboards/keyboardRepair.js';
import JobAccountingVoidControl from '../modules/jobs/JobAccountingVoidControl.jsx';

export function getSpecialistRepairMode(job) {
  if (isAmplifierJob(job)) {
    return 'amplifier-detail';
  }
  if (isKeyboardJob(job)) {
    return 'keyboard-detail';
  }
  return '';
}

export default function SpecialistJobWorkspaceNav({
  activeMode,
  job,
  onSelectMode,
  canManageAccountingVoid = false,
  onAccountingVoidChange,
  onNotice
}) {
  const repairMode = getSpecialistRepairMode(job);
  if (!repairMode) {
    return null;
  }

  const repairLabel = repairMode === 'amplifier-detail' ? 'Amplifier Bench' : 'Keyboard Bench';

  function selectMode(nextMode) {
    if (nextMode !== activeMode) {
      onSelectMode?.(job.id, nextMode);
    }
  }

  return (
    <>
      <section className="panel specialist-workspace-nav no-print" aria-label="Specialist work order workspace">
        <div>
          <p className="eyebrow">Complete work order</p>
          <strong>Diagnostics and shop operations stay on the same job.</strong>
          <p className="muted-text">Switch views without losing the repair record, billable parts, services, payments, or customer documents.</p>
        </div>
        <div className="mode-actions specialist-workspace-actions">
          <button
            type="button"
            className={activeMode === repairMode ? 'primary-action' : 'button-tertiary'}
            aria-pressed={activeMode === repairMode}
            onClick={() => selectMode(repairMode)}
          >
            {repairLabel}
          </button>
          <button
            type="button"
            className={activeMode === 'detail' ? 'primary-action' : 'button-tertiary'}
            aria-pressed={activeMode === 'detail'}
            onClick={() => selectMode('detail')}
          >
            Work Order, Parts &amp; Payments
          </button>
        </div>
      </section>
      {activeMode === repairMode && (
        <JobAccountingVoidControl
          job={job}
          canManage={canManageAccountingVoid}
          onChange={onAccountingVoidChange}
          onNotice={onNotice}
        />
      )}
    </>
  );
}
