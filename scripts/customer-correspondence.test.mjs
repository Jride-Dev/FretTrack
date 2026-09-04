import assert from 'node:assert/strict';
import test from 'node:test';

import {
  clampCorrespondenceLimit,
  CORRESPONDENCE_DIRECTIONS,
  fromDbCorrespondenceMessage,
  getSelectedCustomerReportCorrespondence,
  isCustomerReportEligible,
  normalizeCorrespondenceMessage,
  normalizeCorrespondenceThread,
  sortCorrespondence
} from '../src/modules/messaging/customerCorrespondence.js';
import { buildSelectedDocumentEmailContent } from '../src/modules/jobs/emailDocuments.js';

test('correspondence limits preserve zero long enough to enforce the minimum', () => {
  assert.equal(clampCorrespondenceLimit(0), 1);
  assert.equal(clampCorrespondenceLimit('0'), 1);
  assert.equal(clampCorrespondenceLimit(-12), 1);
  assert.equal(clampCorrespondenceLimit(32.9), 32);
  assert.equal(clampCorrespondenceLimit(900), 500);
  assert.equal(clampCorrespondenceLimit('not-a-number'), 200);
  assert.equal(clampCorrespondenceLimit(), 200);
});

test('existing outbound message rows retain their current application shape', () => {
  const message = fromDbCorrespondenceMessage({
    id: 'message-1',
    job_id: 'job-1',
    customer_id: 'customer-1',
    channel: 'email',
    recipient: 'customer@example.com',
    subject: 'Repair update',
    body: 'Your repair is ready.',
    template_key: 'ready',
    status: 'sent',
    provider: 'resend',
    provider_message_id: 'provider-1',
    request_id: 'request-1',
    sent_at: '2026-08-25T20:00:00.000Z',
    created_at: '2026-08-25T19:59:00.000Z'
  });

  assert.equal(message.jobId, 'job-1');
  assert.equal(message.customerId, 'customer-1');
  assert.equal(message.direction, CORRESPONDENCE_DIRECTIONS.OUTBOUND);
  assert.equal(message.subject, 'Repair update');
  assert.equal(message.body, 'Your repair is ready.');
  assert.equal(message.status, 'sent');
});

test('future inbound fields normalize without changing current outbound defaults', () => {
  const message = normalizeCorrespondenceMessage({
    id: 'message-2',
    thread_id: 'thread-1',
    shop_id: 'shop-1',
    direction: 'inbound',
    sender_address: '+13105550100',
    recipient: '+13105550200',
    body: 'Go ahead with the repair.',
    status: 'received',
    received_at: '2026-08-25T20:05:00.000Z',
    read_at: '2026-08-25T20:06:00.000Z',
    include_in_customer_report: true
  });

  assert.equal(message.direction, CORRESPONDENCE_DIRECTIONS.INBOUND);
  assert.equal(message.threadId, 'thread-1');
  assert.equal(message.shopId, 'shop-1');
  assert.equal(message.sender, '+13105550100');
  assert.equal(message.includeInCustomerReport, true);
  assert.equal(isCustomerReportEligible(message), true);
});

test('report selection excludes unsent, canceled, empty, and unselected messages', () => {
  const selected = getSelectedCustomerReportCorrespondence([
    message('sent-selected', 'sent', true, '2026-08-25T20:02:00.000Z'),
    message('sent-unselected', 'sent', false, '2026-08-25T20:01:00.000Z'),
    message('scheduled-selected', 'scheduled', true, '2026-08-25T20:03:00.000Z'),
    message('empty-selected', 'sent', true, '2026-08-25T20:04:00.000Z', '')
  ]);

  assert.deepEqual(selected.map((item) => item.id), ['sent-selected']);
});

test('correspondence sorting does not mutate its source array', () => {
  const messages = [
    message('older', 'sent', false, '2026-08-25T20:00:00.000Z'),
    message('newer', 'sent', false, '2026-08-25T21:00:00.000Z')
  ];
  const sorted = sortCorrespondence(messages);

  assert.deepEqual(sorted.map((item) => item.id), ['newer', 'older']);
  assert.deepEqual(messages.map((item) => item.id), ['older', 'newer']);
});

test('conversation threads normalize provider-neutral storage fields', () => {
  const thread = normalizeCorrespondenceThread({
    id: 'thread-1',
    shop_id: 'shop-1',
    customer_id: 'customer-1',
    channel: 'sms',
    contact_address: '+13105550100',
    status: 'archived',
    created_at: '2026-09-02T01:00:00.000Z',
    updated_at: '2026-09-02T02:00:00.000Z'
  });

  assert.deepEqual(thread, {
    id: 'thread-1',
    shopId: 'shop-1',
    customerId: 'customer-1',
    channel: 'sms',
    contactAddress: '+13105550100',
    status: 'archived',
    createdAt: '2026-09-02T01:00:00.000Z',
    updatedAt: '2026-09-02T02:00:00.000Z'
  });
});

test('customer report email content includes only selected eligible correspondence', () => {
  const content = buildSelectedDocumentEmailContent({
    shopId: 'test-shop',
    customerName: 'Report Customer',
    jobNumber: 'JOB-1',
    instrumentType: 'Electric Guitar',
    messages: [
      {
        id: 'report-message-1',
        channel: 'email',
        direction: 'inbound',
        subject: 'Approval note',
        body: 'Please proceed.',
        status: 'received',
        includeInCustomerReport: true,
        receivedAt: '2026-08-25T20:05:00.000Z'
      },
      {
        id: 'report-message-2',
        channel: 'email',
        direction: 'outbound',
        subject: 'Internal note',
        body: 'Keep this out of the report.',
        status: 'sent',
        includeInCustomerReport: false,
        sentAt: '2026-08-25T20:06:00.000Z'
      }
    ]
  }, { shopSettings: { shopId: 'test-shop', shopName: 'Test Shop' } }, { includeCustomerReport: true });

  assert.match(content.text, /Approval note/);
  assert.match(content.text, /Please proceed\./);
  assert.doesNotMatch(content.text, /Keep this out of the report/);
});

function message(id, status, includeInCustomerReport, createdAt, body = 'Customer-facing message') {
  return {
    id,
    channel: 'email',
    direction: 'outbound',
    recipient: 'customer@example.com',
    body,
    status,
    includeInCustomerReport,
    createdAt
  };
}
