export const defaultTemplateKey = 'check_in';

export const messageTemplates = {
  check_in: {
    label: 'Check-in',
    subject: "We've got your {{instrument}} - Job #{{job_number}}",
    body: "Hi {{customer_name}},\n\nWe've checked in your {{instrument}}.\n\nJob #: {{job_number}}\n\nWe'll go through it and reach out once we have an estimate or if anything comes up.\n\n{{shop_signature}}"
  },
  drop_off_scheduled: {
    label: 'Drop Off Scheduled',
    subject: 'Drop-off scheduled for {{appointment_datetime}} - Job #{{job_number}}',
    body: "Hi {{customer_name}},\n\nYour appointment is scheduled for {{appointment_datetime}}.\n\nPlease reply if you need to change the drop-off time.\n\nJob #: {{job_number}}\nInstrument: {{instrument}}\n\n{{shop_signature}}"
  },
  estimate_ready: {
    label: 'Estimate ready',
    subject: 'Estimate ready for your {{instrument}} (Job #{{job_number}})',
    body: "Hi {{customer_name}},\n\nYour estimate revision {{estimate_revision}} for {{instrument}} is ready. The estimated total is {{estimate_total}}.\n\nPlease review the line-by-line estimate using the Email Estimate action in the work order, then let me know if you'd like me to move forward.\n\nJob #: {{job_number}}\n\n{{shop_signature}}"
  },
  approval_needed: {
    label: 'Approval needed',
    subject: 'Approval needed - Job #{{job_number}}',
    body: "Hi {{customer_name}},\n\nBefore I continue with your {{instrument}}, I need your approval on the work.\n\nReply here or call/text me to confirm.\n\nJob #: {{job_number}}\n\n{{shop_signature}}"
  },
  work_started: {
    label: 'Work started',
    subject: 'Work started on your {{instrument}} (Job #{{job_number}})',
    body: "Hi {{customer_name}},\n\nJust a quick update - I've started work on your {{instrument}}.\n\nI'll keep you posted if anything comes up.\n\nJob #: {{job_number}}\n\n{{shop_signature}}"
  },
  repair_complete: {
    label: 'Repair complete',
    subject: 'Your {{instrument}} is ready - Job #{{job_number}}',
    body: "Hi {{customer_name}},\n\nYour {{instrument}} is all set and ready for pickup.\n\nEverything's been gone through and it's playing clean.\n\nJob #: {{job_number}}\n\nLet me know when you're planning to come by.\n\n{{shop_signature}}"
  },
  pickup_reminder: {
    label: 'Pickup reminder',
    subject: 'Pickup reminder - Job #{{job_number}}',
    body: "Hi {{customer_name}},\n\nJust a reminder that your {{instrument}} is ready for pickup.\n\nWhenever you're ready, swing by.\n\nJob #: {{job_number}}\n\n{{shop_signature}}"
  },
  payment_reminder: {
    label: 'Payment reminder',
    subject: 'Balance due - Job #{{job_number}}',
    body: "Hi {{customer_name}},\n\nThere's still a balance due for your {{instrument}}.\n\nLet me know if you need anything or want to take care of it before pickup.\n\nJob #: {{job_number}}\n\n{{shop_signature}}"
  },
  update_with_photos: {
    label: 'Update with photos',
    subject: 'Update on your {{instrument}} - Job #{{job_number}}',
    body: "Hi {{customer_name}},\n\nHere's a quick update on your {{instrument}}.\n\nI've attached a couple photos so you can see what's going on.\n\nLet me know how you'd like to proceed.\n\nJob #: {{job_number}}\n\n{{shop_signature}}"
  },
  keyboard_diagnostic_report: {
    label: 'Keyboard diagnostic report',
    subject: 'Keyboard diagnostic report - Job #{{job_number}}',
    body: "Hi {{customer_name}},\n\nYour keyboard diagnostic report is ready. The report includes the keybed findings, diagnosis, recommended parts, and current repair estimate.\n\nJob #: {{job_number}}\nInstrument: {{instrument}}\n\nReply if you have questions or would like to approve the work.\n\n{{shop_signature}}"
  }
};

export function renderTemplate(template, variables) {
  return template.replace(/\{\{(\w+)\}\}/g, (_, key) => variables[key] || '');
}

export function instrumentName(job) {
  return [job.guitarBrand, job.model].filter(Boolean).join(' ') || job.instrumentType || 'instrument';
}

export function buildShopSignature(shopProfile = {}) {
  return [
    shopProfile.shopName,
    shopProfile.address,
    shopProfile.phone,
    shopProfile.email,
    shopProfile.website
  ].map((value) => String(value || '').trim()).filter(Boolean).join('\n');
}
