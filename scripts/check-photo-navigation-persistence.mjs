import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  findUploadedJobImage,
  getPhotoUnavailableMessage,
  mergeUploadedJobImages
} from '../src/modules/photos/photoState.js';

const originalJob = {
  id: 'job-1',
  customerName: 'Test Customer',
  techDetails: { damageMap: { selectedView: 'front', views: {} } },
  images: [{ id: 'old-photo', storagePath: 'job-1/old.jpg', url: 'signed-old' }]
};
const uploadedJob = {
  ...originalJob,
  customerName: 'Stale Upload Snapshot',
  images: [
    ...originalJob.images,
    {
      id: 'damage-photo',
      category: 'damage-map-front',
      originalFileName: 'front.jpg',
      storagePath: 'job-1/front.jpg',
      url: 'signed-front'
    }
  ]
};
const currentDraft = {
  ...originalJob,
  customerName: 'Unsaved Current Name',
  techDetails: {
    damageMap: {
      selectedView: 'back',
      views: { back: { marks: [{ id: 'mark-1' }] } }
    }
  }
};

const merged = mergeUploadedJobImages(currentDraft, uploadedJob);
assert.equal(merged.customerName, 'Unsaved Current Name', 'Upload completion must not replace current draft fields.');
assert.deepEqual(merged.techDetails, currentDraft.techDetails, 'Upload completion must preserve current Damage Map edits.');
assert.equal(merged.images.at(-1).storagePath, 'job-1/front.jpg', 'Upload completion must merge the durable photo row.');

const uploadedImage = findUploadedJobImage({
  beforeImages: originalJob.images,
  uploadedImages: uploadedJob.images,
  category: 'damage-map-front',
  originalFileName: 'front.jpg'
});
assert.equal(uploadedImage?.id, 'damage-photo', 'The newly persisted Damage Map photo must be identified.');

assert.equal(
  getPhotoUnavailableMessage({ storagePath: 'job-1/front.jpg' }),
  'Photo unavailable. Could not load from storage.',
  'A signing/display failure must not be reported as a missing path.'
);
assert.equal(
  getPhotoUnavailableMessage({}),
  'Photo unavailable. Storage path missing.',
  'Only records without a durable path should show the missing-path warning.'
);

const damageMapSource = readFileSync(resolve('src/components/DamageMap.js'), 'utf8');
assert.ok(
  !damageMapSource.includes('Damage view image upload failed. Using local preview.'),
  'Configured remote Damage Map uploads must never silently fall back to a temporary preview.'
);
assert.ok(
  !damageMapSource.includes('Damage marker photo upload failed. Using local preview.'),
  'Configured remote marker uploads must never silently fall back to a temporary preview.'
);

const photoControllerSource = readFileSync(resolve('src/modules/jobs/useJobPhotoController.js'), 'utf8');
const handlerStart = photoControllerSource.indexOf('async function handleDamageViewImageUpload');
const handlerEnd = photoControllerSource.indexOf('function handleImageDelete', handlerStart);
const handlerSource = photoControllerSource.slice(handlerStart, handlerEnd);
assert.ok(handlerSource.includes('mergeUploadedJobImages'), 'Damage uploads must merge into the current draft.');
assert.ok(!handlerSource.includes('setIsDirty(false)'), 'Damage uploads must not clear the unsaved Damage Map state.');

console.log('Photo navigation persistence checks passed.');
