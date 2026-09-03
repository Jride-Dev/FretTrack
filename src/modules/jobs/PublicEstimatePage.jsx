import { useEffect, useMemo, useState } from 'react';
import { formatMinorMoney } from '../../shared/utils/money.js';
import { loadPublicEstimate, respondToPublicEstimate } from './publicEstimateService.js';

export default function PublicEstimatePage({ token }) {
  const [result, setResult] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isResponding, setIsResponding] = useState(false);
  const [responseNote, setResponseNote] = useState('');
  const [confirmResponse, setConfirmResponse] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let isMounted = true;
    setIsLoading(true);
    loadPublicEstimate(token)
      .then((nextResult) => {
        if (isMounted) {
          setResult(nextResult);
          setError(nextResult?.ok ? '' : nextResult?.error || 'This estimate link is invalid or expired.');
        }
      })
      .catch((loadError) => {
        if (isMounted) {
          setError(loadError.message || 'This estimate link could not be opened.');
        }
      })
      .finally(() => {
        if (isMounted) {
          setIsLoading(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [token]);

  const estimate = result?.estimate;
  const moneyOptions = useMemo(() => ({
    currency: estimate?.shop?.currencyCode || estimate?.snapshot?.currencyCode || 'USD',
    locale: estimate?.shop?.locale || undefined
  }), [estimate]);
  const snapshot = estimate?.snapshot || {};
  const status = estimate?.status || 'sent';
  const isActionable = status === 'sent';

  async function handleResponse(decision) {
    if (!isActionable || isResponding) {
      return;
    }
    if (!confirmResponse) {
      setError('Confirm that you reviewed this estimate before responding.');
      return;
    }

    setError('');
    setIsResponding(true);
    try {
      const nextResult = await respondToPublicEstimate(token, decision, responseNote.trim());
      setResult(nextResult);
      setResponseNote('');
      setConfirmResponse(false);
      if (!nextResult?.ok) {
        setError(nextResult?.error || 'The estimate response could not be recorded.');
      }
    } catch (responseError) {
      setError(responseError.message || 'The estimate response could not be recorded.');
    } finally {
      setIsResponding(false);
    }
  }

  if (isLoading) {
    return <main className="public-estimate-shell"><section className="public-estimate-card" role="status">Loading estimate…</section></main>;
  }

  if (!estimate) {
    return (
      <main className="public-estimate-shell">
        <section className="public-estimate-card" role="alert">
          <p className="public-estimate-eyebrow">FretTrack estimate</p>
          <h1>Estimate unavailable</h1>
          <p>{error || 'This estimate link is invalid or expired.'}</p>
        </section>
      </main>
    );
  }

  const services = estimate.services || [];
  const parts = estimate.parts || [];

  return (
    <main className="public-estimate-shell">
      <article className="public-estimate-card">
        <header className="public-estimate-header">
          <div>
            <p className="public-estimate-eyebrow">Customer estimate</p>
            <h1>{estimate.shop?.name || 'FretTrack Shop'}</h1>
            <p>{estimate.shop?.address || ''}</p>
            <p>{[estimate.shop?.phone, estimate.shop?.email].filter(Boolean).join(' · ')}</p>
          </div>
          <div className="public-estimate-meta">
            <strong>Estimate #{estimate.jobNumber || '—'}</strong>
            <span>Revision {estimate.revision}</span>
            <span className={`estimate-status estimate-status-${status}`}>{formatStatus(status)}</span>
          </div>
        </header>

        <section className="public-estimate-summary">
          <div><span>Customer</span><strong>{estimate.customerName || 'Customer'}</strong></div>
          <div><span>Instrument</span><strong>{[estimate.guitarBrand, estimate.model, estimate.instrumentType].filter(Boolean).join(' · ') || 'Instrument'}</strong></div>
          <div><span>Valid through</span><strong>{formatDate(estimate.expiresAt)}</strong></div>
        </section>

        <section className="public-estimate-lines">
          <h2>Included services and parts</h2>
          <table>
            <thead><tr><th>Description</th><th>Qty</th><th>Unit price</th><th>Total</th></tr></thead>
            <tbody>
              {services.map((row, index) => <EstimateLine key={`service-${index}`} description={row.description} quantity={row.quantity} unitMinor={row.unitMinor} lineMinor={row.lineMinor} moneyOptions={moneyOptions} />)}
              {parts.map((row, index) => <EstimateLine key={`part-${index}`} description={row.name} quantity={row.quantity} unitMinor={row.unitMinor} lineMinor={row.lineMinor} included={row.included} moneyOptions={moneyOptions} />)}
              {services.length === 0 && parts.length === 0 && <tr><td colSpan="4">No line items were included.</td></tr>}
            </tbody>
          </table>
        </section>

        <section className="public-estimate-total-block">
          <div><span>Subtotal</span><strong>{formatMinorMoney(snapshot.subtotalMinor, moneyOptions)}</strong></div>
          <div><span>Discount</span><strong>-{formatMinorMoney(snapshot.discountMinor, moneyOptions)}</strong></div>
          <div><span>{snapshot.taxLabel || 'Sales Tax'}</span><strong>{formatMinorMoney(snapshot.taxMinor, moneyOptions)}</strong></div>
          <div className="public-estimate-grand-total"><span>Estimated total</span><strong>{formatMinorMoney(snapshot.totalMinor, moneyOptions)}</strong></div>
        </section>

        {error && <p className="public-estimate-error" role="alert">{error}</p>}

        {isActionable && (
          <section className="public-estimate-response no-print">
            <h2>Review this estimate</h2>
            <p>Approve the locked estimate to authorize the shop to proceed, or decline it and leave a note.</p>
            <label>
              Note (optional)
              <textarea value={responseNote} onChange={(event) => setResponseNote(event.target.value)} maxLength="500" rows="3" placeholder="Questions or instructions for the shop" disabled={isResponding} />
            </label>
            <label className="checkline"><input type="checkbox" checked={confirmResponse} onChange={(event) => setConfirmResponse(event.target.checked)} disabled={isResponding} /> I reviewed the line items and total above.</label>
            <div className="mode-actions">
              <button type="button" onClick={() => handleResponse('approved')} disabled={isResponding || !confirmResponse}>{isResponding ? 'Recording…' : 'Approve Estimate'}</button>
              <button type="button" className="button-tertiary" onClick={() => handleResponse('declined')} disabled={isResponding || !confirmResponse}>Decline Estimate</button>
              <button type="button" className="button-tertiary" onClick={() => window.print()} disabled={isResponding}>Print / Save PDF</button>
            </div>
          </section>
        )}

        {!isActionable && (
          <section className={`public-estimate-response public-estimate-response-${status}`}>
            <h2>{status === 'approved' ? 'Estimate approved' : 'Estimate declined'}</h2>
            <p>{status === 'approved' ? 'The shop has a record of your approval for this estimate revision.' : 'The shop has a record of your decision for this estimate revision.'}</p>
            <button type="button" className="button-tertiary no-print" onClick={() => window.print()}>Print / Save PDF</button>
          </section>
        )}

        {estimate.shop?.footer && <footer className="public-estimate-footer">{estimate.shop.footer}</footer>}
      </article>
    </main>
  );
}

function EstimateLine({ description, quantity, unitMinor, lineMinor, included, moneyOptions }) {
  return (
    <tr>
      <td>{description || 'Line item'}{included && <small>Included in service</small>}</td>
      <td>{quantity || 1}</td>
      <td>{included ? 'Included' : formatMinorMoney(unitMinor, moneyOptions)}</td>
      <td>{included ? 'Included' : formatMinorMoney(lineMinor, moneyOptions)}</td>
    </tr>
  );
}

function formatStatus(value) {
  return String(value || 'sent').charAt(0).toUpperCase() + String(value || 'sent').slice(1);
}

function formatDate(value) {
  if (!value) {
    return '—';
  }
  try {
    return new Date(value).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
  } catch {
    return '—';
  }
}
