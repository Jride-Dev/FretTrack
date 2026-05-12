import { useState } from 'react';
import OverviewTab from './tabs/OverviewTab.jsx';
import IntakeTab from './tabs/IntakeTab.jsx';
import InspectionTab from './tabs/InspectionTab.jsx';
import WorkTab from './tabs/WorkTab.jsx';
import PartsBillingTab from './tabs/PartsBillingTab.jsx';
import PhotosTab from './tabs/PhotosTab.jsx';
import PrintCustomerTab from './tabs/PrintCustomerTab.jsx';
import TimelineTab from './tabs/TimelineTab.jsx';

const tabs = [
  { key: 'overview', label: 'Overview' },
  { key: 'intake', label: 'Intake' },
  { key: 'inspection', label: 'Inspection' },
  { key: 'work', label: 'Work' },
  { key: 'billing', label: 'Parts & Billing' },
  { key: 'photos', label: 'Photos' },
  { key: 'print', label: 'Print' },
  { key: 'timeline', label: 'Timeline' }
];

export default function JobDetailTabs({
  activityTimeline,
  billingSections,
  draftJob,
  imagesSection,
  intakeSection,
  inspectionSections,
  isDirty,
  messagesPanel,
  printActions,
  printSections,
  updateField,
  workSections
}) {
  const [activeTab, setActiveTab] = useState('overview');

  return (
    <div className="job-workspace">
      <div className="job-tab-bar no-print" role="tablist" aria-label="Job workspace tabs">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            type="button"
            role="tab"
            aria-selected={activeTab === tab.key}
            className={activeTab === tab.key ? 'active' : ''}
            onClick={() => setActiveTab(tab.key)}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === 'overview' && (
        <OverviewTab draftJob={draftJob} isDirty={isDirty} updateField={updateField} printActions={printActions} />
      )}
      {activeTab === 'intake' && <IntakeTab>{intakeSection}</IntakeTab>}
      {activeTab === 'inspection' && <InspectionTab>{inspectionSections}</InspectionTab>}
      {activeTab === 'work' && <WorkTab>{workSections}</WorkTab>}
      {activeTab === 'billing' && <PartsBillingTab>{billingSections}</PartsBillingTab>}
      {activeTab === 'photos' && <PhotosTab>{imagesSection}</PhotosTab>}
      {activeTab === 'print' && <PrintCustomerTab>{printActions}{messagesPanel}</PrintCustomerTab>}
      {activeTab === 'timeline' && <TimelineTab>{activityTimeline}</TimelineTab>}

      <div className="print-only">
        {printSections}
      </div>
    </div>
  );
}
