import { execFileSync } from 'node:child_process';

const strict = process.argv.includes('--strict');

function runSupabaseMigrationList() {
  try {
    const command = process.platform === 'win32' ? 'cmd.exe' : 'npx';
    const args = process.platform === 'win32'
      ? ['/d', '/s', '/c', 'npx supabase migration list']
      : ['supabase', 'migration', 'list'];
    return execFileSync(command, args, {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
      timeout: 30000
    });
  } catch (error) {
    const output = [error.stdout, error.stderr].filter(Boolean).join('\n').trim();
    throw new Error(`${output || error.message}\n\nUnable to read Supabase migration history. Check Supabase auth, network, and SUPABASE_DB_PASSWORD if the pooler reports authentication errors.`);
  }
}

function parseMigrationRows(output) {
  return output
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => /^\d{14}\s+\||^\|\s*\d{14}|^\|\s+\|\s*\d{14}|^\d{14}\s+\|\s*$/.test(line) || line.includes('|'))
    .map((line) => line.split('|').map((part) => part.trim()))
    .filter((parts) => parts.length >= 2)
    .map(([local, remote]) => ({
      local: /^\d{14}$/.test(local) ? local : '',
      remote: /^\d{14}$/.test(remote) ? remote : ''
    }))
    .filter((row) => row.local || row.remote);
}

let output = '';
try {
  output = runSupabaseMigrationList();
} catch (error) {
  console.error(error.message);
  process.exit(1);
}

const rows = parseMigrationRows(output);
const remoteOnly = rows.filter((row) => row.remote && !row.local).map((row) => row.remote);
const localOnly = rows.filter((row) => row.local && !row.remote).map((row) => row.local);

if (remoteOnly.length) {
  console.error('Remote Supabase migrations are missing locally:');
  remoteOnly.forEach((version) => console.error(`- ${version}`));
  console.error('\nRecover those migration files or reconcile history before creating/applying new migrations.');
  process.exit(1);
}

if (strict && localOnly.length) {
  console.error('Local Supabase migrations are not applied remotely:');
  localOnly.forEach((version) => console.error(`- ${version}`));
  console.error('\nRun a dry run and push after reviewing the pending migrations.');
  process.exit(1);
}

console.log('Supabase migration history has no remote-only drift.');
if (localOnly.length) {
  console.log('Pending local migrations:');
  localOnly.forEach((version) => console.log(`- ${version}`));
}
