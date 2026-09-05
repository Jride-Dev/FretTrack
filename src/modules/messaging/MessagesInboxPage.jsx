import { useMemo } from 'react';
import WorkspacePageHeader from '../../shared/components/WorkspacePageHeader.jsx';
import { buildCustomerDirectory } from '../customers/customerInsights.js';
import UnassignedCorrespondenceQueue from './UnassignedCorrespondenceQueue.jsx';

export default function MessagesInboxPage({
  customers = [],
  jobs = [],
  shopId = '',
  shopProfile = null,
  canWrite = false,
  dateOptions = {},
  onNotice
}) {
  const directoryCustomers = useMemo(
    () => buildCustomerDirectory(customers, jobs, { shopProfile }),
    [customers, jobs, shopProfile]
  );

  return (
    <section className="messages-inbox-page">
      <WorkspacePageHeader
        eyebrow="Customer communication"
        title="Messages"
        description="Review incoming customer replies and route each unassigned message to the correct work order."
      />
      <UnassignedCorrespondenceQueue
        customers={directoryCustomers}
        shopId={shopId}
        canWrite={canWrite}
        dateOptions={dateOptions}
        onNotice={onNotice}
      />
    </section>
  );
}
