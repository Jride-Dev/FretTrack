import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const functionsDir = path.join(root, 'supabase', 'functions');
const denoCommand = resolveDenoCommand();

const result = spawnSync(denoCommand, [
  'check',
  'create-checkout-session/index.ts',
  'create-billing-portal-session/index.ts',
  'stripe-webhook/index.ts'
], {
  cwd: functionsDir,
  shell: process.platform === 'win32',
  stdio: 'inherit'
});

if (result.error) {
  console.error(result.error.message);
  process.exit(1);
}

process.exit(result.status ?? 1);

function resolveDenoCommand() {
  const configured = process.env.DENO_BIN || '';
  if (configured && fs.existsSync(configured)) {
    return configured;
  }

  if (process.platform === 'win32') {
    const userProfile = process.env.USERPROFILE || '';
    const userDeno = path.join(userProfile, '.deno', 'bin', 'deno.exe');
    if (fs.existsSync(userDeno)) {
      return userDeno;
    }
    return 'deno.exe';
  }

  return 'deno';
}
