import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import {
  mkdtempSync,
  mkdirSync,
  rmSync,
  unlinkSync,
  utimesSync,
  writeFileSync
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

const root = process.cwd();
const restoreScript = resolve(root, 'scripts/refresh-local-db-from-hosted-backup.ps1');
const fixtureRoot = mkdtempSync(join(tmpdir(), 'frettrack-backup-safety-'));
const powershell = process.platform === 'win32' ? 'powershell.exe' : 'pwsh';

try {
  const validSnapshot = createSnapshot('hosted-supabase-20260813-100000');
  const failedSnapshot = createSnapshot('hosted-supabase-20260813-110000');
  writeFileSync(join(failedSnapshot, 'FAILED.txt'), 'Storage copy failed.\n');
  utimesSync(validSnapshot, new Date('2026-08-13T10:00:00Z'), new Date('2026-08-13T10:00:00Z'));
  utimesSync(failedSnapshot, new Date('2026-08-13T11:00:00Z'), new Date('2026-08-13T11:00:00Z'));

  const automatic = validate(['-BackupRoot', fixtureRoot]);
  assert.equal(automatic.status, 0, automatic.output);
  assert.ok(automatic.output.includes(validSnapshot), 'Automatic selection must fall back to the latest complete snapshot.');
  assert.ok(!automatic.output.match(new RegExp(`Snapshot: ${escapeRegex(failedSnapshot)}`, 'i')), 'Automatic selection must not restore a failed snapshot.');

  const explicitFailed = validate(['-BackupRoot', fixtureRoot, '-SnapshotDir', failedSnapshot]);
  assert.notEqual(explicitFailed.status, 0, 'An explicitly selected failed snapshot must be rejected.');
  assert.match(explicitFailed.output, /marked failed by FAILED\.txt/i);

  const corruptSnapshot = createSnapshot('hosted-supabase-20260813-120000');
  unlinkSync(join(corruptSnapshot, 'storage-buckets', 'job-images', 'photo.jpg'));
  const explicitCorrupt = validate(['-BackupRoot', fixtureRoot, '-SnapshotDir', corruptSnapshot]);
  assert.notEqual(explicitCorrupt.status, 0, 'A snapshot missing a manifest file must be rejected.');
  assert.match(explicitCorrupt.output, /manifest file is missing/i);

  const explicitValid = validate(['-BackupRoot', fixtureRoot, '-SnapshotDir', validSnapshot]);
  assert.equal(explicitValid.status, 0, explicitValid.output);

  console.log('Backup restore snapshot safety checks passed.');
} finally {
  rmSync(fixtureRoot, { recursive: true, force: true });
}

function createSnapshot(name) {
  const snapshotDir = join(fixtureRoot, name);
  const files = new Map([
    ['roles.sql', '-- roles'],
    ['schema.sql', '-- schema'],
    ['data.sql', '-- data'],
    ['migration_history_schema.sql', '-- migration schema'],
    ['migration_history_data.sql', '-- migration data'],
    ['storage-buckets/bucket-list.txt', 'job-images\n'],
    ['storage-buckets/job-images/_object-list.txt', 'job-images/photo.jpg\n'],
    ['storage-buckets/job-images/photo.jpg', 'photo bytes']
  ]);

  for (const [relativePath, content] of files) {
    const destination = join(snapshotDir, ...relativePath.split('/'));
    mkdirSync(resolve(destination, '..'), { recursive: true });
    writeFileSync(destination, content);
  }

  const manifest = {
    created_at: new Date().toISOString(),
    files: [...files].map(([relativePath, content]) => ({
      path: relativePath,
      bytes: Buffer.byteLength(content),
      sha256: createHash('sha256').update(content).digest('hex')
    }))
  };
  writeFileSync(join(snapshotDir, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`);
  writeFileSync(join(snapshotDir, 'checksums.sha256'), 'fixture checksums are represented by manifest.json\n');
  writeFileSync(join(snapshotDir, 'compare-report.md'), '# Complete fixture\n');
  return snapshotDir;
}

function validate(extraArguments) {
  const result = spawnSync(powershell, [
    '-NoProfile',
    '-ExecutionPolicy',
    'Bypass',
    '-File',
    restoreScript,
    '-ProjectRoot',
    root,
    '-ValidateSnapshotOnly',
    ...extraArguments
  ], {
    cwd: root,
    encoding: 'utf8'
  });

  if (result.error) {
    throw result.error;
  }
  return {
    status: result.status,
    output: `${result.stdout || ''}\n${result.stderr || ''}`
  };
}

function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
