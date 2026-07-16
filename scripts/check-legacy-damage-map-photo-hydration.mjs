import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = process.cwd();
const read = (file) => readFileSync(resolve(root, file), 'utf8');
const assertIncludes = (source, expected, message) => {
  assert.ok(source.includes(expected), message || ('Expected source to include: ' + expected));
};

const jobService = read('src/modules/jobs/jobService.js');
const photoUrls = read('src/modules/photos/photoUrls.js');
const damageMap = read('src/components/DamageMap.js');

assertIncludes(jobService, 'const damageMapStoragePathKeys', 'Damage Map storage-path aliases must be declared.');
assertIncludes(jobService, "'storagePath'", 'Camel-case Damage Map storage paths must remain supported.');
assertIncludes(jobService, "'storage_path'", 'Legacy snake-case Damage Map storage paths must be supported.');
assertIncludes(jobService, "'imagePath'", 'Legacy Damage Map image paths must be supported.');
assertIncludes(jobService, "'photoPath'", 'Legacy Damage Map photo paths must be supported.');
assertIncludes(jobService, 'const damageMapViewUrlKeys', 'Damage Map view URL aliases must be declared.');
assertIncludes(jobService, "'imageUrl'", 'Camel-case view URLs must remain supported.');
assertIncludes(jobService, "'image_url'", 'Legacy snake-case view URLs must be supported.');
assertIncludes(jobService, 'const damageMapMarkUrlKeys', 'Damage Map marker URL aliases must be declared.');
assertIncludes(jobService, "'photoUrl'", 'Camel-case marker URLs must remain supported.');
assertIncludes(jobService, "'photo_url'", 'Legacy snake-case marker URLs must be supported.');
assertIncludes(jobService, "'public_url'", 'Legacy public URL fields must be considered only as a fallback source.');
assertIncludes(jobService, 'function getDamageMapPhotoSource', 'Damage Map image hydration must use a dedicated legacy source resolver.');
assertIncludes(jobService, 'getJobImageStoragePath({ storagePath: explicitStoragePath, url })', 'Damage Map paths must be recovered before URL hydration.');
assertIncludes(jobService, 'getDamageMapViewPhotoSource(view)', 'Damage Map view normalization and hydration must use legacy source resolution.');
assertIncludes(jobService, 'getDamageMapMarkPhotoSource(mark)', 'Damage Map marker normalization and hydration must use legacy source resolution.');
assertIncludes(jobService, 'async function hydrateDamageMapImageUrls', 'Damage Map hydration must remain separate from the normal gallery path.');
assertIncludes(jobService, 'storagePath: viewStoragePath', 'Damage Map view hydration must pass the recovered path to the signed URL resolver.');
assertIncludes(jobService, 'storagePath: markStoragePath', 'Damage Map marker hydration must pass the recovered path to the signed URL resolver.');
assertIncludes(jobService, 'imageUrl: getPersistableJobImageUrl({ url, storagePath })', 'Damage Map view persistence must clear transient URLs when a storage path exists.');
assertIncludes(jobService, 'photoUrl: getPersistableJobImageUrl({ url, storagePath })', 'Damage Map marker persistence must clear transient URLs when a storage path exists.');
assertIncludes(photoUrls, 'createJobImageSignedUrl(storagePath)', 'Stored image paths must regenerate signed URLs.');
assertIncludes(photoUrls, 'Photo record missing storage path. Display may fail after temporary URLs expire.', 'Unrecoverable legacy URLs must warn instead of pretending to be durable.');
assertIncludes(damageMap, 'storagePath: uploadedImage.storagePath ||', 'New Damage Map uploads must keep their stable storage path.');

console.log('Legacy Damage Map photo hydration checks passed.');
