import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import {pathForBodyFile, tryReadBody, writeBody} from '../src/message-body-utils.js';

describe('message body storage', () => {
  let root;
  beforeEach(() => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), 'isomorphic-body-'));
    vi.stubEnv('NYLAS_HOME', root);
  });
  afterEach(() => {
    vi.unstubAllEnvs();
    fs.rmSync(root, {recursive: true, force: true});
    vi.restoreAllMocks();
  });

  it('shards ids into five directories', () => {
    expect(pathForBodyFile('abcdefghijklmnop')).toBe(path.join(root, 'messages', 'ab', 'cd', 'ef', 'gh', 'ij', 'klmnop.nylasmail'));
  });

  it('stores and reads a compressible body', () => {
    const body = 'compress me '.repeat(100);
    const stored = writeBody({msgId: 'abcdefghijklmnop', body});
    expect(JSON.parse(stored)).toMatchObject({compressed: true});
    expect(tryReadBody(stored)).toBe(body);
  });

  it('keeps short bodies inline and rejects arbitrary metadata paths', () => {
    expect(writeBody({msgId: 'shortidentifier', body: 'tiny'})).toBe('tiny');
    expect(tryReadBody('plain body')).toBeNull();
    expect(tryReadBody(JSON.stringify({path: '/tmp/outside', compressed: false}))).toBeNull();
  });

  it('reads uncompressed metadata and falls back when disk writes fail', () => {
    const target = pathForBodyFile('abcdefghijklmnop');
    fs.mkdirSync(path.dirname(target), {recursive: true});
    fs.writeFileSync(target, 'uncompressed');
    expect(tryReadBody(JSON.stringify({path: target, compressed: false}))).toBe('uncompressed');
    vi.spyOn(fs, 'writeFileSync').mockImplementation(() => { throw new Error('disk full'); });
    const body = 'fallback '.repeat(100);
    expect(writeBody({msgId: 'zzzzzzzzzzremaining', body})).toBe(body);
  });
});
