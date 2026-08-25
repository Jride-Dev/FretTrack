import { spawnSync } from 'node:child_process';
import process from 'node:process';

export function resolveCommand(name, options = {}) {
  const commandName = String(name || '').trim();
  if (!/^[A-Za-z0-9._-]+$/.test(commandName)) {
    throw new Error('Command name must contain only letters, numbers, dots, underscores, or dashes.');
  }

  const platform = options.platform || process.platform;
  const run = options.spawnSync || spawnSync;
  const lookup = platform === 'win32'
    ? { command: 'where.exe', args: [commandName] }
    : { command: 'sh', args: ['-c', 'command -v "$1"', 'resolve-command', commandName] };

  let result;
  try {
    result = run(lookup.command, lookup.args, {
      encoding: 'utf8',
      windowsHide: true
    });
  } catch {
    throw cliNotFound(commandName);
  }

  const stdout = typeof result?.stdout === 'string'
    ? result.stdout
    : Buffer.isBuffer(result?.stdout)
      ? result.stdout.toString('utf8')
      : '';
  const command = stdout
    .split(/\r?\n/)
    .map((value) => value.trim())
    .find(Boolean);

  if (result?.error || result?.status !== 0 || !command) {
    throw cliNotFound(commandName);
  }
  return command;
}

function cliNotFound(name) {
  return new Error(`${name} CLI was not found on PATH.`);
}
