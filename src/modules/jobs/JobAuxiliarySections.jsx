import ActivityTimeline from './ActivityTimeline.jsx';
import MessagesPanel from '../messaging/MessagesPanel';
import JobScheduleSection from '../scheduling/JobScheduleSection.jsx';
import { getSmsMode } from '../../data/messagesRepository';

export default function buildJobAuxiliarySections({
  canSendEmail,
  canScheduleEmail,
  canSendSms,
  canWrite,
  draftJob,
  entitlementMessage,
  onContactPreferenceChange,
  onMessageTemplateChange,
  onNotice,
  onSendCustomerMessage,
  shopProfile,
  timelineEvents
}) {
  return {
    activityTimeline: <ActivityTimeline events={timelineEvents} />,
    messagesPanel: (
      <MessagesPanel
        canWrite={canWrite}
        canSendEmailByPlan={canSendEmail}
        canScheduleEmail={canScheduleEmail}
        canSendSmsByPlan={canSendSms}
        entitlementMessage={entitlementMessage}
        job={draftJob}
        shopProfile={shopProfile}
        onPreferenceChange={onContactPreferenceChange}
        onTemplateChange={onMessageTemplateChange}
        onSendMessage={onSendCustomerMessage}
        onGetSmsMode={getSmsMode}
      />
    ),
    schedulingSection: (
      <JobScheduleSection
        canWrite={canWrite}
        job={draftJob}
        onNotice={onNotice}
      />
    )
  };
}
