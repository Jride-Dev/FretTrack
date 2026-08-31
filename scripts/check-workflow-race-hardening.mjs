import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const read = (path) => readFileSync(join(process.cwd(), path), 'utf8');
const photos = read('src/modules/photos/photoService.js');
const photoController = read('src/modules/jobs/useJobPhotoController.js');
const communication = read('src/modules/jobs/jobDetailCommunicationActions.js');
const messagesPanel = read('src/modules/messaging/MessagesPanel.js');
const billing = read('src/modules/jobs/useJobDetailBillingActions.js');
const mutations = read('src/modules/jobs/jobServiceMutations.js');

assert.match(photoController, /uploadIdentityRef = useRef\(new Map\(\)\)/, 'Photo retries must retain stable upload identities.');
assert.match(photoController, /canceledUploadIdsRef = useRef\(new Set\(\)\)/, 'Pending photo deletions must invalidate their upload operation.');
assert.match(photoController, /onImageUpload\(draftJobRef\.current, files, \{ uploadIds \}\)/, 'Photo identities must cross the workspace upload boundary.');
assert.match(photoController, /uploadedImages\.filter\(\(image\) => !canceledUploadIdsRef\.current\.has\(image\.id\)\)/, 'Canceled uploads must not be merged back into the visible draft.');
assert.match(photos, /uploadId: options\.uploadIds\?\.\[index\][\s\S]*?imageId = options\.uploadId \|\| crypto\.randomUUID\(\)/, 'The service must reuse the caller upload identity.');
assert.match(photos, /findExistingUploadedImage\(jobId, imageId\)/, 'Upload retries must reconcile an existing database record before creating another.');
assert.match(photos, /requestId: imageId/, 'Photo quota and object retries must reuse the upload identity.');
assert.match(communication, /Customer message was accepted, but the work-order refresh failed[\s\S]*?refreshWarning/, 'A post-send refresh failure must preserve the confirmed send result.');
assert.match(messagesPanel, /sendOperationRef = useRef\(new Map\(\)\)/, 'Message retries must retain a stable request identity.');
assert.match(messagesPanel, /setSendState\(\{ sending: '', error: error\?\.message/, 'Unexpected send failures must clear the sending state.');
assert.doesNotMatch(billing, /await saveDraftNow\(draftJob\)[\s\S]*?recordJobPayment/, 'Hosted payments must not run a full draft save before the payment RPC.');
assert.match(mutations, /preserveStoredPaymentHistory\(toDbJobFromModule\(job\), storedJob\?\.tech_details\)/, 'General work-order saves must preserve database-owned payment history.');

console.log('Workflow race hardening checks passed.');
