import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const rootDir = process.cwd();

function readFile(relativePath) {
  return fs.readFileSync(path.join(rootDir, relativePath), 'utf8');
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function assertIncludes(source, snippet, fileName) {
  assert(source.includes(snippet), `${fileName} must include: ${snippet}`);
}

function assertNotMatches(source, pattern, fileName, message) {
  assert(!pattern.test(source), `${fileName}: ${message}`);
}

const photoUrls = readFile('src/modules/photos/photoUrls.js');
const photoService = readFile('src/modules/photos/photoService.js');
const jobNormalization = readFile('src/modules/jobs/jobServiceNormalization.js');
const jobQueries = readFile('src/modules/jobs/jobServiceQueries.js');
const photoGallery = readFile('src/modules/photos/PhotoGallery.jsx');
const damageMap = readFile('src/components/DamageMap.js');

const resolverStart = photoUrls.indexOf('export async function resolveJobImageUrl');
const resolverEnd = photoUrls.indexOf('export async function resolveJobImageUrls');
const resolverBody = photoUrls.slice(resolverStart, resolverEnd);
const signedUrlIndex = resolverBody.indexOf('createJobImageSignedUrl(storagePath)');
const fallbackReturnIndex = resolverBody.indexOf('return safeFallbackUrl');

assert(resolverStart >= 0 && resolverEnd > resolverStart, 'photoUrls.js must define resolveJobImageUrl and resolveJobImageUrls.');
assert(signedUrlIndex >= 0, 'resolveJobImageUrl must regenerate signed URLs from storagePath.');
assert(
  fallbackReturnIndex === -1 || signedUrlIndex < fallbackReturnIndex,
  'resolveJobImageUrl must try storagePath signed URL regeneration before returning fallback URLs.'
);
assertIncludes(photoUrls, 'getJobImageStoragePathFromUrl', 'photoUrls.js');
assertIncludes(photoUrls, 'getPersistableJobImageUrl', 'photoUrls.js');
assertIncludes(photoUrls, 'Photo record missing storage path', 'photoUrls.js');

assertIncludes(photoService, "url: ''", 'photoService.js');
assertIncludes(photoService, "public_url: ''", 'photoService.js');
assertIncludes(photoService, 'storage_path: image.storagePath', 'photoService.js');
assertIncludes(photoService, 'storage_path: updatedImage.storagePath', 'photoService.js');
assertIncludes(photoService, 'getJobImageStoragePath(image)', 'photoService.js');
assertIncludes(photoService, 'getJobImageStoragePath(sourceImage)', 'photoService.js');
assertIncludes(photoService, 'await reservePhotoUsage({', 'photoService.js');
assertIncludes(photoService, 'await settlePhotoUsage({ shopId, requestId });', 'photoService.js');
assertIncludes(photoService, 'releaseDeletedPhotoStorage({', 'photoService.js');
assertNotMatches(
  photoService,
  /public_url:\s*(image|updatedImage|sourceImage)\.url/,
  'photoService.js',
  'job image database writes must not persist temporary display URLs.'
);

assertIncludes(jobQueries, 'sanitizeJobForPersistence', 'jobServiceQueries.js');
assertIncludes(jobQueries, 'sanitizeJobForPersistence(normalizeJob(job))', 'jobServiceQueries.js');
assertIncludes(jobNormalization, 'export function sanitizeJobForPersistence', 'jobServiceNormalization.js');
assertIncludes(jobNormalization, 'export function sanitizeTechDetailsForPersistence', 'jobServiceNormalization.js');
assertIncludes(jobNormalization, 'export function sanitizeDamageMapForPersistence', 'jobServiceNormalization.js');
assertIncludes(jobNormalization, 'url: storagePath ?', 'jobServiceNormalization.js');
assertIncludes(jobNormalization, 'getJobImageStoragePath({', 'jobServiceNormalization.js');
assertIncludes(jobNormalization, 'resolveJobImageUrl({', 'jobServiceNormalization.js');

assertIncludes(photoGallery, 'getPhotoUnavailableMessage(image)', 'PhotoGallery.jsx');
assertIncludes(damageMap, 'storagePath: uploadedImage.storagePath ||', 'DamageMap.js');
assertNotMatches(
  jobNormalization,
  /tech_details:\s*\{[\s\S]{0,200}\.\.\.\(job\.techDetails\s*\|\|\s*\{\}\)/,
  'jobServiceNormalization.js',
  'tech_details persistence must sanitize damage map photo URLs before database writes.'
);

console.log('Job photo persistence checks passed.');
