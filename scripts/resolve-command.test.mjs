import assert from 'node:assert/strict';
import process from 'node:process';
import test from 'node:test';
import { resolveCommand } from './resolve-command.mjs';

test('the current platform resolves Node from the real PATH', () => {
  const command = resolveCommand('node');
  assert.ok(command);
  if (process.platform === 'win32') {
    assert.match(command, /node(?:\.exe|\.cmd)?$/i);
  } else {
    assert.match(command, /(?:^|\/)node$/);
  }
});

test('Linux command lookup uses the POSIX shell and returns the resolved executable', () => {
  let invocation;
  const command = resolveCommand('supabase', {
    platform: 'linux',
    spawnSync(executable, args, options) {
      invocation = { executable, args, options };
      return { status: 0, stdout: '/usr/local/bin/supabase\n' };
    }
  });

  assert.equal(command, '/usr/local/bin/supabase');
  assert.equal(invocation.executable, 'sh');
  assert.deepEqual(invocation.args, ['-c', 'command -v "$1"', 'resolve-command', 'supabase']);
  assert.equal(invocation.options.encoding, 'utf8');
});

test('Windows command lookup retains where.exe and uses the first result', () => {
  let invocation;
  const command = resolveCommand('stripe', {
    platform: 'win32',
    spawnSync(executable, args) {
      invocation = { executable, args };
      return { status: 0, stdout: 'C:\\Tools\\stripe.exe\r\nC:\\Tools\\stripe.cmd\r\n' };
    }
  });

  assert.equal(command, 'C:\\Tools\\stripe.exe');
  assert.equal(invocation.executable, 'where.exe');
  assert.deepEqual(invocation.args, ['stripe']);
});

test('missing lookup output produces a controlled CLI error instead of a TypeError', () => {
  assert.throws(
    () => resolveCommand('supabase', {
      platform: 'linux',
      spawnSync() {
        return { status: null, error: new Error('spawn sh ENOENT'), stdout: undefined };
      }
    }),
    { message: 'supabase CLI was not found on PATH.' }
  );
});

test('a nonzero lookup result produces a controlled CLI error', () => {
  assert.throws(
    () => resolveCommand('stripe', {
      platform: 'linux',
      spawnSync() {
        return { status: 127, stdout: '' };
      }
    }),
    { message: 'stripe CLI was not found on PATH.' }
  );
});
