import {EventEmitter} from 'node:events';
import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';

const childMocks = vi.hoisted(() => ({spawn: vi.fn(), exec: vi.fn()}));
vi.mock('child_process', () => ({default: childMocks}));

import {exec, spawn} from '../src/shell-utils.js';

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe('trimTo', () => {
  beforeEach(() => vi.resetModules());

  it('preserves short strings and trims long strings around an ellipsis', async () => {
    vi.stubGlobal('window', {});
    const {trimTo} = await import('../src/string-utils.js');
    expect(trimTo('short', 10)).toBe('short');
    expect(trimTo('abcdefghij', 6)).toBe('abc…hij');
  });

  it('uses environment and browser defaults', async () => {
    vi.stubEnv('TRIM_SIZE', '4');
    vi.stubGlobal('window', {});
    let imported = await import('../src/string-utils.js');
    expect(imported.trimTo('abcdefgh')).toBe('ab…gh');
    vi.resetModules();
    vi.stubEnv('TRIM_SIZE', '');
    vi.stubGlobal('window', {TRIM_SIZE: 2});
    imported = await import('../src/string-utils.js');
    expect(imported.trimTo('abcd')).toBe('a…d');
  });
});

describe('shell utilities', () => {
  it('collects stdout and stderr and merges environment options', async () => {
    const proc = new EventEmitter();
    proc.stdout = new EventEmitter();
    proc.stderr = new EventEmitter();
    childMocks.spawn.mockReturnValue(proc);
    const promise = spawn('tool', ['arg'], {cwd: '/tmp', env: {TASK_TOKEN: 'x'}});
    proc.stdout.emit('data', Buffer.from('out'));
    proc.stderr.emit('data', 'err');
    proc.emit('exit', 0);
    await expect(promise).resolves.toEqual({stdout: 'out', stderr: 'err'});
    expect(childMocks.spawn).toHaveBeenCalledWith('tool', ['arg'], expect.objectContaining({
      cwd: '/tmp', env: expect.objectContaining({TASK_TOKEN: 'x'}),
    }));
  });

  it('rejects spawn errors', async () => {
    const proc = new EventEmitter();
    proc.stdout = new EventEmitter();
    proc.stderr = new EventEmitter();
    childMocks.spawn.mockReturnValue(proc);
    const promise = spawn('missing', []);
    const error = new Error('ENOENT');
    proc.emit('error', error);
    await expect(promise).rejects.toBe(error);
  });

  it('resolves and rejects exec callbacks', async () => {
    childMocks.exec.mockImplementationOnce((_cmd, _opts, callback) => callback(null, 'result'));
    await expect(exec('safe command', {cwd: '/tmp'})).resolves.toBe('result');
    const error = new Error('failed');
    childMocks.exec.mockImplementationOnce((_cmd, _opts, callback) => callback(error, ''));
    await expect(exec('bad command')).rejects.toBe(error);
  });
});
