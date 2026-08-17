import { useEffect, useMemo, useState } from 'react';
import { sendCustomerMessage } from '../../data/messagesRepository.js';
import { buildShopSignature } from '../messaging/messageTemplates.js';
import { getShopMoneyOptions } from '../shops/shopConfig.js';
import {
  KEYBOARD_FAULTS,
  buildKeyboardCustomerReport,
  findKeyboardInventoryMatches,
  getKeyboardFault,
  isBlackMidiNote,
  keyboardMidiRange,
  midiNoteLabel
} from './keyboardDiagnostics.js';
import {
  createKeyboardPartRequest,
  deleteKeyboardKeyState,
  fulfillKeyboardPartRequest,
  loadKeyboardWorkflow,
  saveKeyboardKeyState,
  updateKeyboardPartRequest
} from './keyboardWorkflowService.js';

const EMPTY_WORKFLOW = { keyStates: [], partRequests: [], inventoryParts: [] };

function emptyFinding(midiNote) {
  return {
    id: '',
    midiNote,
    keyLabel: midiNoteLabel(midiNote),
    conditionStatus: 'fault',
    faultCode: 'stuck_key',
    faultCategory: 'Mechanical',
    severity: 'moderate',
    velocityMin: '',
    velocityMax: '',
    notes: '',
    updatedAt: ''
  };
}

export default function KeyboardWorkflowPanel({
  job,
  keyboard,
  canWrite,
  canSendEmail,
  entitlementMessage,
  shopProfile,
  onRefresh,
  onSaveJob,
  onInventoryPartAdded,
  onNotice
}) {
  const keyRange = useMemo(() => keyboardMidiRange(keyboard.keyCount, keyboard.lowestMidiNote), [keyboard.keyCount, keyboard.lowestMidiNote]);
  const [workflow, setWorkflow] = useState(EMPTY_WORKFLOW);
  const [selectedMidiNote, setSelectedMidiNote] = useState(keyRange[0]);
  const [finding, setFinding] = useState(() => emptyFinding(keyRange[0]));
  const [requestPartName, setRequestPartName] = useState('');
  const [requestQuantity, setRequestQuantity] = useState(1);
  const [isLoading, setIsLoading] = useState(true);
  const [isWorking, setIsWorking] = useState(false);
  const [loadError, setLoadError] = useState('');

  async function load() {
    if (!job.id) return;
    setIsLoading(true);
    setLoadError('');
    try {
      setWorkflow(await loadKeyboardWorkflow(job.id, job.shopId));
    } catch (error) {
      setLoadError(error.message || 'Unable to load keyboard diagnostics.');
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    setSelectedMidiNote(keyRange[0]);
    setFinding(emptyFinding(keyRange[0]));
    load();
  }, [job.id]);

  useEffect(() => {
    if (!keyRange.includes(selectedMidiNote)) {
      setSelectedMidiNote(keyRange[0]);
      setFinding(emptyFinding(keyRange[0]));
    }
  }, [keyRange.join(','), selectedMidiNote]);

  const statesByNote = useMemo(() => new Map(workflow.keyStates.map((state) => [state.midiNote, state])), [workflow.keyStates]);
  const selectedState = statesByNote.get(selectedMidiNote) || null;
  const inventoryMatches = useMemo(
    () => findKeyboardInventoryMatches(workflow.inventoryParts, finding.faultCode),
    [finding.faultCode, workflow.inventoryParts]
  );

  function selectKey(midiNote) {
    setSelectedMidiNote(midiNote);
    const existing = statesByNote.get(midiNote);
    setFinding(existing ? { ...existing } : emptyFinding(midiNote));
    setRequestPartName('');
  }

  function updateFinding(event) {
    const { name, value } = event.target;
    setFinding((current) => {
      if (name !== 'faultCode') return { ...current, [name]: value };
      const fault = getKeyboardFault(value);
      return { ...current, faultCode: value, faultCategory: fault.category };
    });
  }

  async function saveFinding() {
    setIsWorking(true);
    try {
      const saved = await saveKeyboardKeyState(job.id, finding, finding.updatedAt);
      setWorkflow((current) => ({
        ...current,
        keyStates: [...current.keyStates.filter((state) => state.id !== saved.id), saved].sort((a, b) => a.midiNote - b.midiNote)
      }));
      setFinding(saved);
      onNotice?.({ type: 'success', message: `Saved ${saved.keyLabel} diagnostic finding.` });
    } catch (error) {
      onNotice?.({ type: 'error', message: error.message || 'Unable to save key finding.' });
    } finally {
      setIsWorking(false);
    }
  }

  async function removeFinding() {
    if (!selectedState || !window.confirm(`Remove the finding for ${selectedState.keyLabel}?`)) return;
    setIsWorking(true);
    try {
      await deleteKeyboardKeyState(selectedState);
      setWorkflow((current) => ({ ...current, keyStates: current.keyStates.filter((state) => state.id !== selectedState.id) }));
      setFinding(emptyFinding(selectedMidiNote));
      onNotice?.({ type: 'success', message: `Removed ${selectedState.keyLabel} diagnostic finding.` });
    } catch (error) {
      onNotice?.({ type: 'error', message: error.message || 'Unable to remove key finding.' });
    } finally {
      setIsWorking(false);
    }
  }

  async function requestPart(part = null) {
    const requestedPart = part?.name || requestPartName.trim();
    if (!requestedPart) {
      onNotice?.({ type: 'error', message: 'Choose an inventory match or enter the requested part.' });
      return;
    }
    setIsWorking(true);
    try {
      const request = await createKeyboardPartRequest(job.id, {
        keyStateId: finding.id || null,
        inventoryPartId: part?.id || null,
        requestedPart,
        quantity: requestQuantity,
        notes: `${finding.keyLabel}: ${getKeyboardFault(finding.faultCode).label}`
      });
      setWorkflow((current) => ({ ...current, partRequests: [...current.partRequests, request] }));
      setRequestPartName('');
      onNotice?.({ type: 'success', message: `Requested ${requestedPart}.` });
    } catch (error) {
      onNotice?.({ type: 'error', message: error.message || 'Unable to create parts request.' });
    } finally {
      setIsWorking(false);
    }
  }

  async function addRequestedPart(request) {
    if (!request.inventoryPartId) return;
    setIsWorking(true);
    try {
      const { jobPart, partRequests } = await fulfillKeyboardPartRequest(request);
      onInventoryPartAdded?.(jobPart);
      setWorkflow((current) => ({ ...current, partRequests }));
      await onRefresh?.();
      onNotice?.({ type: 'success', message: `${request.requestedPart} was added to the work order and inventory was adjusted.` });
    } catch (error) {
      onNotice?.({ type: 'error', message: error.message || 'Unable to add the inventory part.' });
    } finally {
      setIsWorking(false);
    }
  }

  async function changeRequestStatus(request, requestStatus) {
    setIsWorking(true);
    try {
      const updated = await updateKeyboardPartRequest(request, { requestStatus });
      setWorkflow((current) => ({
        ...current,
        partRequests: current.partRequests.map((item) => item.id === updated.id ? updated : item)
      }));
    } catch (error) {
      onNotice?.({ type: 'error', message: error.message || 'Unable to update the parts request.' });
    } finally {
      setIsWorking(false);
    }
  }

  async function sendCustomerReport() {
    if (!canSendEmail) {
      onNotice?.({ type: 'error', message: entitlementMessage || 'Email sending is unavailable for this shop.' });
      return;
    }
    setIsWorking(true);
    try {
      const savedJob = await onSaveJob?.() || job;
      const report = buildKeyboardCustomerReport(savedJob, workflow.keyStates, workflow.partRequests, {
        moneyOptions: getShopMoneyOptions(shopProfile),
        shopSignature: buildShopSignature(shopProfile || {})
      });
      const result = await sendCustomerMessage(savedJob, {
        channel: 'email',
        customerId: savedJob.customerId || null,
        templateKey: 'keyboard_diagnostic_report',
        to: savedJob.email,
        subject: report.subject,
        body: report.body
      });
      if (!result.ok) throw new Error(result.error || 'The diagnostic report could not be sent.');
      await onRefresh?.();
      onNotice?.({ type: 'success', message: 'Keyboard diagnostic report emailed to the customer.' });
    } catch (error) {
      onNotice?.({ type: 'error', message: error.message || 'Unable to send the diagnostic report.' });
    } finally {
      setIsWorking(false);
    }
  }

  return (
    <section className="panel keyboard-workflow-panel">
      <div className="panel-heading">
        <div>
          <h3>Visual Keybed Diagnostics</h3>
          <p className="muted-text">Click a key to record a standardized physical, contact, velocity, or scan-matrix fault.</p>
        </div>
        <button type="button" className="button-tertiary" onClick={load} disabled={isLoading || isWorking}>Reload Findings</button>
      </div>
      {loadError && <p className="feature-access-note">{loadError}</p>}
      <div className="keyboard-keybed" role="group" aria-label="Keyboard keybed diagnostic map">
        {keyRange.map((midiNote) => {
          const state = statesByNote.get(midiNote);
          return (
            <button
              type="button"
              key={midiNote}
              className={[
                'keyboard-key',
                isBlackMidiNote(midiNote) ? 'black' : 'white',
                state?.conditionStatus === 'fault' ? `fault ${state.severity}` : state?.conditionStatus || '',
                selectedMidiNote === midiNote ? 'selected' : ''
              ].filter(Boolean).join(' ')}
              onClick={() => selectKey(midiNote)}
              title={`${midiNoteLabel(midiNote)}${state?.faultCode ? `: ${getKeyboardFault(state.faultCode).label}` : ''}`}
              aria-label={`${midiNoteLabel(midiNote)}${state?.faultCode ? `, ${getKeyboardFault(state.faultCode).label}` : ', no finding'}`}
            ><span>{midiNoteLabel(midiNote)}</span></button>
          );
        })}
      </div>

      <div className="form-grid keyboard-finding-editor">
        <label>
          Selected Key
          <input value={finding.keyLabel} readOnly />
        </label>
        <label>
          State
          <select name="conditionStatus" value={finding.conditionStatus} onChange={updateFinding} disabled={!canWrite}>
            <option value="fault">Fault</option><option value="pass">Pass</option><option value="not_tested">Not tested</option>
          </select>
        </label>
        <label>
          Fault
          <select name="faultCode" value={finding.faultCode} onChange={updateFinding} disabled={!canWrite || finding.conditionStatus !== 'fault'}>
            {KEYBOARD_FAULTS.map((fault) => <option key={fault.code} value={fault.code}>{fault.label}</option>)}
          </select>
        </label>
        <label>
          Severity
          <select name="severity" value={finding.severity} onChange={updateFinding} disabled={!canWrite || finding.conditionStatus !== 'fault'}>
            <option value="minor">Minor</option><option value="moderate">Moderate</option><option value="major">Major</option>
          </select>
        </label>
        <label>Velocity Min<input type="number" min="0" max="127" name="velocityMin" value={finding.velocityMin ?? ''} onChange={updateFinding} disabled={!canWrite} /></label>
        <label>Velocity Max<input type="number" min="0" max="127" name="velocityMax" value={finding.velocityMax ?? ''} onChange={updateFinding} disabled={!canWrite} /></label>
        <label className="wide">Finding Notes<textarea name="notes" value={finding.notes} onChange={updateFinding} rows="3" disabled={!canWrite} /></label>
      </div>
      <div className="mode-actions no-print">
        <button type="button" onClick={saveFinding} disabled={!canWrite || isWorking || isLoading}>Save Key Finding</button>
        {selectedState && <button type="button" className="button-tertiary" onClick={removeFinding} disabled={!canWrite || isWorking}>Remove Finding</button>}
      </div>

      <section className="keyboard-parts-cross-reference">
        <h4>Fault-to-Parts Cross-reference</h4>
        <p className="muted-text">Matches are ranked from this fault against the shop’s active inventory. Adding a matched part uses FretTrack’s existing stock and job-cost workflow.</p>
        <div className="keyboard-parts-matches">
          {inventoryMatches.map((part) => (
            <button type="button" className="keyboard-part-match" key={part.id} onClick={() => requestPart(part)} disabled={!canWrite || isWorking}>
              <strong>{part.name}</strong><span>{part.quantityOnHand} on hand · {part.location || 'No bin'}</span><small>{part.sku || part.partNumber || 'No SKU'}</small>
            </button>
          ))}
          {!inventoryMatches.length && <p className="empty-state">No active inventory item matches this fault yet.</p>}
        </div>
        <div className="row-form">
          <label>Requested Part<input value={requestPartName} onChange={(event) => setRequestPartName(event.target.value)} disabled={!canWrite} placeholder="Rubber contact strip, return spring…" /></label>
          <label>Quantity<input type="number" min="1" max="999" value={requestQuantity} onChange={(event) => setRequestQuantity(event.target.value)} disabled={!canWrite} /></label>
          <button type="button" onClick={() => requestPart()} disabled={!canWrite || isWorking}>Create Request</button>
        </div>
        <div className="keyboard-parts-requests">
          {workflow.partRequests.map((request) => (
            <div className="keyboard-parts-request" key={request.id}>
              <span><strong>{request.requestedPart}</strong> × {request.quantity}</span>
              {request.requestStatus === 'installed' ? <span>installed</span> : (
                <select aria-label={`${request.requestedPart} request status`} value={request.requestStatus} onChange={(event) => changeRequestStatus(request, event.target.value)} disabled={!canWrite || isWorking}>
                  <option value="requested">Requested</option>
                  <option value="ordered">Ordered</option>
                  <option value="received">Received</option>
                  <option value="not_needed">Not needed</option>
                </select>
              )}
              {request.inventoryPartId && request.requestStatus !== 'installed' && (
                <button type="button" className="button-tertiary" onClick={() => addRequestedPart(request)} disabled={!canWrite || isWorking}>Add to Work Order</button>
              )}
            </div>
          ))}
        </div>
      </section>

      <section className="keyboard-customer-report">
        <h4>Customer Diagnostic Report</h4>
        <p className="muted-text">Builds the email from the saved keyboard profile, fault map, diagnosis, requested parts, and current job costs. Email consent and plan limits are enforced by the existing message service.</p>
        <button type="button" onClick={sendCustomerReport} disabled={!canWrite || !job.email || isWorking}>Send Diagnostic Email</button>
        {!job.email && <small className="muted-text">Add a customer email address before sending.</small>}
      </section>
    </section>
  );
}
