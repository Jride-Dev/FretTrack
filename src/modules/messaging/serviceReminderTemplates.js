export const SERVICE_REMINDER_TEMPLATE_FIELDS = [
  { token: '{{customer_first_name}}', label: 'Customer first name' },
  { token: '{{service_name}}', label: 'Service name' },
  { token: '{{shop_name}}', label: 'Shop name' },
  { token: '{{months}}', label: 'Months since service' },
  { token: '{{booking_url}}', label: 'Booking link' }
];

export function normalizeServiceReminderTemplate(value) {
  return String(value || '').replace(/\\r\\n|\\n|\\r/g, '\n');
}

export function renderServiceReminderTemplate(template, values = {}) {
  return SERVICE_REMINDER_TEMPLATE_FIELDS.reduce((rendered, field) => (
    rendered.replaceAll(field.token, String(values[field.token] ?? ''))
  ), normalizeServiceReminderTemplate(template));
}
