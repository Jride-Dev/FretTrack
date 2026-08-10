import { spawnSync } from 'node:child_process';

const args = new Set(process.argv.slice(2));
const skipDeploy = args.has('--no-deploy') || args.has('--check-only');

const productionEnv = {
  ...process.env,
  VITE_SUPABASE_URL: process.env.VITE_SUPABASE_URL || 'https://sbydcnwrmojbczuvnmsa.supabase.co',
  VITE_SUPABASE_ANON_KEY: process.env.VITE_SUPABASE_ANON_KEY || 'sb_publishable_OzxPmQtby5Y54NNy2ww0mQ_Omh-o7M7',
  VITE_FRETTRACK_SHOP_ID: '',
  VITE_FRETTRACK_SHOP_NAME: ''
};

const steps = [
  'npm run build',
  'npm run check:production-build-config'
];

if (!skipDeploy) {
  steps.push('npx wrangler pages deploy dist --project-name=frettrack --branch=main');
}

for (const command of steps) {
  const result = spawnSync(command, {
    env: productionEnv,
    shell: true,
    stdio: 'inherit'
  });

  if (result.error) {
    console.error(`Production app deploy step failed to start: ${command}`);
    console.error(result.error.message);
    process.exit(1);
  }

  if (result.status !== 0) {
    process.exit(result.status || 1);
  }
}

if (skipDeploy) {
  console.log('Production app deploy preflight passed. Deploy was skipped by request.');
}
