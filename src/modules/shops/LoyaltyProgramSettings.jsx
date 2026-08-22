import { useEffect, useState } from 'react';
import { DEFAULT_LOYALTY_RULE, getLoyaltyRule, saveLoyaltyRule } from '../loyalty/loyaltyService.js';

function hasLoyaltyEntitlement(snapshot) {
  return Boolean(snapshot?.entitlements?.loyalty_program ?? snapshot?.loyalty_program);
}

export default function LoyaltyProgramSettings({ shopId, canManageShop, entitlementSnapshot, onNotice }) {
  const entitled = hasLoyaltyEntitlement(entitlementSnapshot);
  const [rule, setRule] = useState(() => ({ ...DEFAULT_LOYALTY_RULE, shopId }));
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    let active = true;
    if (!shopId || !entitled) {
      setIsLoading(false);
      return () => { active = false; };
    }
    setIsLoading(true);
    getLoyaltyRule(shopId)
      .then((nextRule) => { if (active) setRule(nextRule); })
      .catch((error) => onNotice?.({ type: 'error', message: error.message || 'Unable to load the Loyalty Program.' }))
      .finally(() => { if (active) setIsLoading(false); });
    return () => { active = false; };
  }, [shopId, entitled, onNotice]);

  function update(event) {
    const { name, type, checked, value } = event.target;
    setRule((current) => ({ ...current, [name]: type === 'checkbox' ? checked : value }));
  }

  async function save(event) {
    event.preventDefault();
    setIsSaving(true);
    try {
      setRule(await saveLoyaltyRule(shopId, rule));
      onNotice?.({ type: 'success', message: 'Loyalty Program settings saved and paid work orders were reconciled.' });
    } catch (error) {
      onNotice?.({ type: 'error', message: error.message || 'Unable to save the Loyalty Program.' });
    } finally {
      setIsSaving(false);
    }
  }

  if (!entitled) {
    return (
      <section className="panel loyalty-program-settings feature-gate-card">
        <p className="eyebrow">Pro feature</p>
        <h3>Loyalty Program</h3>
        <p>Upgrade to Pro to award auditable loyalty stamps for completed and fully paid work orders.</p>
      </section>
    );
  }

  return (
    <section className="panel loyalty-program-settings">
      <div className="panel-heading">
        <div>
          <p className="eyebrow">Pro feature</p>
          <h3>Loyalty Program</h3>
          <p className="muted-text">Award stamps only for work orders opened after the program starts, once they are completed and fully paid. Refunds, payment removal, or reopening the job reverses the stamp.</p>
        </div>
      </div>
      <form onSubmit={save}>
        <label className="table-checkbox">
          <input type="checkbox" name="enabled" checked={rule.enabled} onChange={update} disabled={!canManageShop || isSaving || isLoading} />
          Enable the Loyalty Program {rule.programStartedAt ? `(started ${new Date(rule.programStartedAt).toLocaleDateString()})` : ''}
        </label>
        <div className="form-grid loyalty-program-settings-grid">
          <label>Stamps per paid work order
            <input type="number" min="1" max="10" name="pointsPerPaidJob" value={rule.pointsPerPaidJob} onChange={update} disabled={!canManageShop || isSaving} />
          </label>
          <label>Stamps required per reward
            <input type="number" min="2" max="100" name="rewardThreshold" value={rule.rewardThreshold} onChange={update} disabled={!canManageShop || isSaving} />
          </label>
          <label className="wide">Reward name
            <input name="rewardName" value={rule.rewardName} onChange={update} maxLength="120" disabled={!canManageShop || isSaving} placeholder="Free restring labor" />
          </label>
          <label className="wide">Terms shown to staff
            <textarea name="terms" value={rule.terms} onChange={update} rows="4" maxLength="1000" disabled={!canManageShop || isSaving} />
          </label>
        </div>
        <p className="muted-text">Redeeming a reward creates an audit record. It does not silently change an invoice; staff apply the agreed discount or service to the relevant work order.</p>
        {canManageShop && <button type="submit" disabled={isSaving || isLoading}>{isSaving ? 'Saving…' : 'Save Loyalty Settings'}</button>}
      </form>
    </section>
  );
}
