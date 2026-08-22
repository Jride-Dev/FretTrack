import { useEffect, useRef, useState } from 'react';
import { formatShopDate } from '../../shared/utils/dateFormat.js';
import { getCustomerLoyalty, redeemCustomerLoyaltyReward } from './loyaltyService.js';

export default function CustomerLoyaltyCard({ customerId, canWrite, dateOptions = {}, onNotice }) {
  const [loyalty, setLoyalty] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRedeeming, setIsRedeeming] = useState(false);
  const redemptionKeyRef = useRef('');

  async function load() {
    setIsLoading(true);
    try {
      setLoyalty(await getCustomerLoyalty(customerId));
    } catch (error) {
      onNotice?.({ type: 'error', message: error.message || 'Unable to load customer loyalty activity.' });
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => { load(); }, [customerId]);

  async function redeem() {
    if (!loyalty?.availableRewards || isRedeeming) return;
    if (!window.confirm(`Redeem one “${loyalty.rewardName}” for ${loyalty.rewardThreshold} stamps? This records redemption but does not alter an invoice.`)) return;
    if (!redemptionKeyRef.current) redemptionKeyRef.current = crypto.randomUUID();
    setIsRedeeming(true);
    try {
      await redeemCustomerLoyaltyReward(customerId, {
        idempotencyKey: redemptionKeyRef.current,
        note: 'Redeemed from customer profile.'
      });
      redemptionKeyRef.current = '';
      await load();
      onNotice?.({ type: 'success', message: `${loyalty.rewardName} redeemed. Apply the agreed benefit to the customer’s work order separately.` });
    } catch (error) {
      onNotice?.({ type: 'error', message: error.message || 'Unable to redeem the loyalty reward.' });
    } finally {
      setIsRedeeming(false);
    }
  }

  return (
    <section className="customer-loyalty-card">
      <div className="panel-heading">
        <div>
          <h3>Loyalty</h3>
          <p className="muted-text">Stamps come only from completed, fully paid work orders.</p>
        </div>
        <button type="button" className="button-tertiary no-print" onClick={load} disabled={isLoading || isRedeeming}>Reload</button>
      </div>
      {isLoading && <p className="muted-text">Loading loyalty activity…</p>}
      {!isLoading && loyalty && (
        <>
          {!loyalty.programEnabled && <p className="muted-text">This shop’s Loyalty Program is currently disabled.</p>}
          <div className="customer-summary-grid loyalty-summary-grid">
            <Summary label="Available stamps" value={loyalty.availablePoints} />
            <Summary label="Lifetime earned" value={loyalty.earnedPoints} />
            <Summary label="Redeemed" value={loyalty.redeemedPoints} />
            <Summary label="Rewards ready" value={loyalty.availableRewards} />
          </div>
          <p><strong>{loyalty.rewardName}</strong> every {loyalty.rewardThreshold} stamps.</p>
          {canWrite && loyalty.programEnabled && (
            <button type="button" onClick={redeem} disabled={!loyalty.availableRewards || isRedeeming}>
              {isRedeeming ? 'Redeeming…' : `Redeem ${loyalty.rewardName}`}
            </button>
          )}
          {loyalty.programEnabled && !loyalty.availableRewards && <p className="muted-text">{loyalty.pointsToNextReward} more stamp{loyalty.pointsToNextReward === 1 ? '' : 's'} toward the next reward.</p>}
          <LoyaltyActivity loyalty={loyalty} dateOptions={dateOptions} />
        </>
      )}
    </section>
  );
}

function Summary({ label, value }) {
  return <article className="summary-card"><span>{label}</span><strong>{value}</strong></article>;
}

function LoyaltyActivity({ loyalty, dateOptions }) {
  const activity = [
    ...loyalty.awards.map((award) => ({
      id: `award-${award.id}`,
      date: award.active ? award.qualified_at : award.reversed_at || award.qualified_at,
      label: award.active ? `+${award.points} stamp${award.points === 1 ? '' : 's'} earned` : `${award.points} stamp${award.points === 1 ? '' : 's'} reversed`,
      note: award.active ? 'Completed and fully paid work order' : award.reversal_reason
    })),
    ...loyalty.redemptions.map((redemption) => ({
      id: `redemption-${redemption.id}`,
      date: redemption.created_at,
      label: `-${redemption.points_spent} stamps redeemed`,
      note: [redemption.reward_name_snapshot, redemption.note].filter(Boolean).join(' — ')
    }))
  ].sort((left, right) => new Date(right.date) - new Date(left.date)).slice(0, 10);

  if (!activity.length) return <p className="muted-text">No loyalty activity yet.</p>;
  return (
    <div className="loyalty-activity">
      <h4>Recent Loyalty Activity</h4>
      {activity.map((item) => (
        <div key={item.id} className="loyalty-activity-row">
          <span><strong>{item.label}</strong><small>{item.note}</small></span>
          <time>{formatShopDate(item.date, dateOptions)}</time>
        </div>
      ))}
    </div>
  );
}
