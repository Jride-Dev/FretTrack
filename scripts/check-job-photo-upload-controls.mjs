import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const root = process.cwd();

function read(relativePath) {
  return readFileSync(join(root, relativePath), 'utf8');
}

function assertIncludes(source, expected, message) {
  assert.ok(source.includes(expected), message || `Expected source to include: ${expected}`);
}

const permissionService = read('src/modules/auth/permissionService.js');
const app = read('src/app/App.jsx');
const jobDetail = read('src/modules/jobs/JobDetail.jsx');
const imagesSection = read('src/modules/jobs/ImagesSection.js');
const photoGallery = read('src/modules/photos/PhotoGallery.jsx');
const photoUrls = read('src/modules/photos/photoUrls.js');

assertIncludes(permissionService, 'export function canUploadPhotos', 'Photo upload permission helper must remain centralized.');
assertIncludes(permissionService, 'return canWriteShop({ role, entitlementSnapshot });', 'Basic photo uploads must follow lifecycle-aware job write access.');
assert.ok(!permissionService.includes('entitlementSnapshot?.access?.canUploadPhotos !== false'), 'A stale upload flag must not hide core job photo controls.');
assertIncludes(permissionService, 'return canUploadPhotos({ role, entitlementSnapshot }) && hasPhotoEditorEntitlement(entitlementSnapshot);', 'Photo Editor must remain separately entitlement-gated.');

assertIncludes(app, 'canUploadPhotos={canUploadPhotos}', 'App must pass the core photo upload permission into Job Detail.');
assertIncludes(app, 'if (!canUploadPhotos)', 'App upload handler must retain a permission guard.');
assertIncludes(jobDetail, 'canUploadPhotos={canUploadPhotos}', 'Job Detail must pass core upload permission into ImagesSection.');
assertIncludes(jobDetail, 'if (!canUploadPhotos)', 'Job Detail upload handlers must retain a permission guard.');
assertIncludes(imagesSection, 'canUploadPhotos ? (', 'ImagesSection must render the normal uploader from the core upload permission.');
assertIncludes(imagesSection, '<PhotoUploader', 'ImagesSection must retain the normal Take Photo and Import from Device uploader.');
assertIncludes(imagesSection, 'canEdit={canEditPhotos}', 'Photo editing must remain separately permission-gated.');
assertIncludes(imagesSection, 'canDelete={canDeletePhotos}', 'Photo deletion must remain permission-gated.');
assertIncludes(photoGallery, 'canEdit = true', 'PhotoGallery must retain its explicit edit-control prop.');
assertIncludes(photoGallery, 'canDelete = true', 'PhotoGallery must retain its explicit delete-control prop.');
assertIncludes(photoUrls, 'createJobImageSignedUrl(storagePath)', 'Persisted photo rendering must continue regenerating signed URLs from storage paths.');

console.log('Job photo upload control checks passed.');
