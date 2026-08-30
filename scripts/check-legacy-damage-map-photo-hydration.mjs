import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = process.cwd();
const read = (file) => readFileSync(resolve(root, file), 'utf8');
const assertIncludes = (source, expected, message) => {
  assert.ok(source.includes(expected), message || ('Expected source to include: ' + expected));
};

const jobNormalization = read('src/modules/jobs/jobServiceNormalization.js');
const photoUrls = read('src/modules/photos/photoUrls.js');
const damageMap = read('src/components/DamageMap.js');

assertIncludes(jobNormalization, 'const damageMapStoragePathKeys', 'Damage Map storage-path aliases must be declared.');
assertIncludes(jobNormalization, "'storagePath'", 'Camel-case Damage Map storage paths must remain supported.');
assertIncludes(jobNormalization, "'storage_path'", 'Legacy snake-case Damage Map storage paths must be supported.');
assertIncludes(jobNormalization, "'imagePath'", 'Legacy Damage Map image paths must be supported.');
assertIncludes(jobNormalization, "'photoPath'", 'Legacy Damage Map photo paths must be supported.');
assertIncludes(jobNormalization, 'const damageMapViewUrlKeys', 'Damage Map view URL aliases must be declared.');
assertIncludes(jobNormalization, "'imageUrl'", 'Camel-case view URLs must remain supported.');
assertIncludes(jobNormalization, "'image_url'", 'Legacy snake-case view URLs must be supported.');
assertIncludes(jobNormalization, 'const damageMapMarkUrlKeys', 'Damage Map marker URL aliases must be declared.');
assertIncludes(jobNormalization, "'photoUrl'", 'Camel-case marker URLs must remain supported.');
assertIncludes(jobNormalization, "'photo_url'", 'Legacy snake-case marker URLs must be supported.');
assertIncludes(jobNormalization, "'public_url'", 'Legacy public URL fields must be considered only as a fallback source.');
assertIncludes(jobNormalization, 'function getDamageMapPhotoSource', 'Damage Map image hydration must use a dedicated legacy source resolver.');
assertIncludes(jobNormalization, 'getJobImageStoragePath({ storagePath: explicitStoragePath, url })', 'Damage Map paths must be recovered before URL hydration.');
assertIncludes(jobNormalization, 'getDamageMapViewPhotoSource(view)', 'Damage Map view normalization and hydration must use legacy source resolution.');
assertIncludes(jobNormalization, 'getDamageMapMarkPhotoSource(mark)', 'Damage Map marker normalization and hydration must use legacy source resolution.');
assertIncludes(jobNormalization, 'async function hydrateDamageMapImageUrls', 'Damage Map hydration must remain separate from the normal gallery path.');
assertIncludes(jobNormalization, 'storagePath: viewStoragePath', 'Damage Map view hydration must pass the recovered path to the signed URL resolver.');
assertIncludes(jobNormalization, 'storagePath: markStoragePath', 'Damage Map marker hydration must pass the recovered path to the signed URL resolver.');
assertIncludes(jobNormalization, 'imageUrl: getPersistableJobImageUrl({ url, storagePath })', 'Damage Map view persistence must clear transient URLs when a storage path exists.');
assertIncludes(jobNormalization, 'photoUrl: getPersistableJobImageUrl({ url, storagePath })', 'Damage Map marker persistence must clear transient URLs when a storage path exists.');
assertIncludes(photoUrls, 'createJobImageSignedUrl(storagePath)', 'Stored image paths must regenerate signed URLs.');
assertIncludes(photoUrls, 'Photo record missing storage path. Display may fail after temporary URLs expire.', 'Unrecoverable legacy URLs must warn instead of pretending to be durable.');
assertIncludes(damageMap, 'storagePath: uploadedImage.storagePath ||', 'New Damage Map uploads must keep their stable storage path.');

console.log('Legacy Damage Map photo hydration checks passed.');
