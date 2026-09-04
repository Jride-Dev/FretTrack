import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const root = process.cwd();
const read = (relativePath) => readFileSync(join(root, relativePath), 'utf8');
const panel = read('src/modules/messaging/CustomerConversationPanel.jsx');
const queue = read('src/modules/messaging/UnassignedCorrespondenceQueue.jsx');
const detail = read('src/modules/customers/CustomerDetail.jsx');
const manager = read('src/modules/customers/CustomerManager.jsx');
const packageJson = JSON.parse(read('package.json'));

assert.match(panel, /listCustomerCorrespondence/, 'the conversation panel must use the correspondence repository');
assert.match(panel, /markCustomerMessageRead/, 'the conversation panel must expose inbound read state');
assert.match(panel, /setCustomerMessageReportInclusion/, 'the conversation panel must expose explicit report selection');
assert.match(panel, /Unassigned/, 'unassigned correspondence must remain visible in the conversation view');
assert.match(panel, /Mark read/, 'the conversation panel must provide a read-state action');
assert.match(panel, /Include in report/, 'the conversation panel must provide report selection');
assert.match(queue, /unassignedOnly: true/, 'the unassigned inbox must query only unassigned correspondence');
assert.match(queue, /direction === 'inbound'/, 'the unassigned inbox must not present outbound records as inbound work');
assert.match(queue, /markCustomerMessageRead/, 'the unassigned inbox must support safe read-state handling');
assert.match(queue, /Unassigned Inbox/, 'the customer workspace must label the unassigned queue clearly');
assert.match(detail, /CustomerConversationPanel/, 'customer detail must render the conversation view');
assert.match(manager, /const activeShopId = shopProfile\?\.shopId/, 'customer workspace must derive the active shop scope');
assert.match(manager, /shopId=\{activeShopId\}/, 'customer detail and queue must receive the active shop scope');
assert.equal(packageJson.scripts['check:customer-conversation'], 'node scripts/check-customer-conversation.mjs');

console.log('Customer conversation checks passed.');
