import { execFileSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { createClient } from '@supabase/supabase-js';

const TEST_EMAIL = 'test1.owner@frettrack.local';
const TEST_PASSWORD = 'FretTrackTest123!';
const FIXTURE_CATEGORY = 'local-photo-navigation-fixture';
const FIXTURE_IMAGE = readFileSync('public/frettrack-wordmark.jpg');

const localEnv = parseEnv(readFileSync('.env.local', 'utf8'));
const statusEnv = parseEnv(execFileSync('supabase', ['status', '-o', 'env'], { encoding: 'utf8' }));
const supabaseUrl = localEnv.VITE_SUPABASE_URL || statusEnv.API_URL;
const anonKey = localEnv.VITE_SUPABASE_ANON_KEY || statusEnv.ANON_KEY;
const serviceRoleKey = statusEnv.SERVICE_ROLE_KEY;

if (!/^https?:\/\/(127\.0\.0\.1|localhost)(:|\/|$)/.test(supabaseUrl || '')) {
  throw new Error('Refusing to create a photo fixture outside local Supabase.');
}
if (!anonKey || !serviceRoleKey) {
  throw new Error('Local Supabase keys are unavailable. Run `supabase start` first.');
}

const admin = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false }
});
const owner = createClient(supabaseUrl, anonKey, {
  auth: { autoRefreshToken: false, persistSession: false }
});

const { data: authData, error: authError } = await owner.auth.signInWithPassword({
  email: TEST_EMAIL,
  password: TEST_PASSWORD
});
if (authError || !authData.user) {
  throw new Error(`Local test-owner sign-in failed: ${authError?.message || 'No user returned.'}`);
}

const { data: membership, error: membershipError } = await owner
  .from('shop_members')
  .select('shop_id')
  .eq('user_id', authData.user.id)
  .limit(1)
  .single();
if (membershipError || !membership?.shop_id) {
  throw new Error(`Local test membership lookup failed: ${membershipError?.message || 'No shop returned.'}`);
}

const { data: jobs, error: jobsError } = await owner
  .from('jobs')
  .select('id, job_number, customer_name, tech_details')
  .eq('shop_id', membership.shop_id)
  .order('created_at', { ascending: false })
  .limit(50);
if (jobsError || !jobs?.length) {
  throw new Error(`Local test job lookup failed: ${jobsError?.message || 'No jobs returned.'}`);
}

const previousFixtureJobs = jobs.filter((candidate) =>
  String(candidate.tech_details?.damageMap?.views?.front?.storagePath || '').includes('local-photo-navigation-fixture.')
);
const job = previousFixtureJobs[0]
  || jobs.find((candidate) => !candidate.tech_details?.damageMap?.views?.front?.storagePath)
  || jobs[0];

const { data: oldFixtureRows, error: oldFixtureError } = await admin
  .from('job_images')
  .select('id, job_id, storage_path')
  .eq('category', FIXTURE_CATEGORY);
if (oldFixtureError) {
  throw oldFixtureError;
}
if (oldFixtureRows?.length) {
  await admin.from('job_images').delete().in('id', oldFixtureRows.map((row) => row.id));
  await admin.storage.from('job-images').remove(oldFixtureRows.map((row) => row.storage_path).filter(Boolean));
}

for (const previousJob of previousFixtureJobs) {
  const previousTechDetails = previousJob.tech_details || {};
  const previousDamageMap = previousTechDetails.damageMap || {};
  const previousViews = previousDamageMap.views || {};
  const previousFront = previousViews.front || {};
  await admin
    .from('jobs')
    .update({
      tech_details: {
        ...previousTechDetails,
        damageMap: {
          ...previousDamageMap,
          views: {
            ...previousViews,
            front: {
              ...previousFront,
              imageId: '',
              imageName: '',
              imageUrl: '',
              storagePath: ''
            }
          }
        }
      }
    })
    .eq('id', previousJob.id)
    .eq('shop_id', membership.shop_id);
}

const storagePath = `${job.id}/local-photo-navigation-fixture.jpg`;

const { error: uploadError } = await admin.storage
  .from('job-images')
  .upload(storagePath, FIXTURE_IMAGE, { contentType: 'image/jpeg', upsert: true });
if (uploadError) {
  throw uploadError;
}

const photoId = randomUUID();
const now = new Date().toISOString();
const { error: insertError } = await admin.from('job_images').insert({
  id: photoId,
  job_id: job.id,
  storage_path: storagePath,
  url: '',
  public_url: '',
  file_name: 'local-photo-navigation-fixture.jpg',
  original_filename: 'local-photo-navigation-fixture.jpg',
  stored_filename: 'local-photo-navigation-fixture.jpg',
  mime_type: 'image/jpeg',
  original_size_bytes: FIXTURE_IMAGE.byteLength,
  optimized_size_bytes: FIXTURE_IMAGE.byteLength,
  width: 640,
  height: 360,
  optimization_version: 'local-test-fixture-v1',
  uploaded_at: now,
  created_at: now,
  category: FIXTURE_CATEGORY
});
if (insertError) {
  throw insertError;
}

const techDetails = job.tech_details || {};
const damageMap = techDetails.damageMap || {};
const views = damageMap.views || {};
const { error: updateError } = await admin
  .from('jobs')
  .update({
    tech_details: {
      ...techDetails,
      damageMap: {
        ...damageMap,
        selectedView: 'front',
        views: {
          ...views,
          front: {
            marks: [],
            ...(views.front || {}),
            imageId: photoId,
            imageName: 'local-photo-navigation-fixture.jpg',
            imageUrl: '',
            storagePath
          }
        }
      }
    }
  })
  .eq('id', job.id)
  .eq('shop_id', membership.shop_id);
if (updateError) {
  throw updateError;
}

const { data: signedData, error: signedError } = await owner.storage
  .from('job-images')
  .createSignedUrl(storagePath, 300);
if (signedError || !signedData?.signedUrl) {
  throw new Error(`Owner could not sign the local fixture: ${signedError?.message || 'No URL returned.'}`);
}
const response = await fetch(signedData.signedUrl);
if (!response.ok) {
  throw new Error(`Signed local fixture returned HTTP ${response.status}.`);
}

console.log(JSON.stringify({
  testServer: 'http://127.0.0.1:5173',
  email: TEST_EMAIL,
  jobId: job.id,
  jobNumber: job.job_number,
  customerName: job.customer_name,
  galleryPhotoId: photoId,
  damageMapView: 'front',
  signedFetchStatus: response.status
}, null, 2));
await owner.auth.signOut();
process.exit(0);

function parseEnv(source) {
  return Object.fromEntries(
    String(source)
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line && !line.startsWith('#') && line.includes('='))
      .map((line) => {
        const separator = line.indexOf('=');
        const key = line.slice(0, separator);
        const value = line.slice(separator + 1).replace(/^"|"$/g, '');
        return [key, value];
      })
  );
}
