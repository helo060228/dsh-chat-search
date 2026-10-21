import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import zlib from 'node:zlib';
import { test } from 'node:test';
import { apply, inject } from '../lib/index.js';

const owner = { peer: { principal: { kind: 'owner' } } };

function createPlugin(admit = () => owner) {
  let route;
  let disposed = false;
  let cleanup;
  let publicRegistrations = 0;
  const ctx = {
    connection: {
      admit,
      fetch: { register(value) { route = value; return () => { disposed = true; }; } }
    },
    webServer: { register() { publicRegistrations++; throw new Error('Public route forbidden'); } },
    effect(callback) { cleanup = callback(); }
  };
  apply(ctx);
  return { ctx, get route() { return route; }, get disposed() { return disposed; },
    get publicRegistrations() { return publicRegistrations; }, dispose() { cleanup?.(); } };
}

function request(query = 'fictional', extraHeaders = {}) {
  return new Request(`http://dsh.internal/api/chat-search?q=${encodeURIComponent(query)}`, {
    headers: { host: '127.0.0.1:32123', origin: 'http://127.0.0.1:32123', ...extraHeaders }
  });
}

function checkHeaders(response) {
  assert.equal(response.headers.get('cache-control'), 'no-store');
  assert.equal(response.headers.get('access-control-allow-origin'), null);
  assert.equal(response.headers.get('access-control-allow-credentials'), null);
  assert.equal(response.headers.get('content-type'), 'application/json; charset=utf-8');
}

async function withNoFilesystemReads(callback) {
  const methods = ['existsSync', 'readdirSync', 'statSync', 'readFileSync'];
  const originals = new Map(methods.map((name) => [name, fs[name]]));
  const reads = [];
  for (const name of methods) fs[name] = () => { reads.push(name); throw new Error('Unexpected session access'); };
  try {
    await callback();
    assert.deepEqual(reads, [], 'Rejected requests must not inspect session roots or files');
  } finally {
    for (const [name, original] of originals) fs[name] = original;
  }
}

async function withSessions(callback) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'dsh-chat-search-synthetic-'));
  const previous = { DSH_HOME: process.env.DSH_HOME, APPDATA: process.env.APPDATA };
  const cwd = process.cwd();
  process.env.DSH_HOME = root;
  process.env.APPDATA = path.join(root, 'appdata');
  process.chdir(root);
  const ws = path.join(root, 'sessions', '--fictional~0020workspace--');
  fs.mkdirSync(path.join(ws, 'session-fictional-a'), { recursive: true });
  fs.mkdirSync(path.join(ws, 'session-fictional-b'), { recursive: true });
  const events = [
    { type: 'session/title', data: { title: 'Synthetic garden' } },
    { type: 'user/message', seq: 11, timestamp: 100, data: { id: 'u11', turn: 2,
      content: [{ type: 'text', text: 'A fictional lantern stands in the garden.' }] } },
    { type: 'assistant/message', seq: 12, timestamp: 110, data: { turn: 2,
      message: { id: 'a12', content: 'The FICTIONAL lantern is blue.' } } }
  ];
  const file = path.join(ws, 'session-fictional-a', 'session.v4.jsonl.zstd');
  const other = path.join(ws, 'session-fictional-b', 'session.v4.jsonl.zstd');
  fs.writeFileSync(file, zlib.zstdCompressSync(Buffer.from(events.map(JSON.stringify).join('\n'))));
  fs.writeFileSync(other, zlib.zstdCompressSync(Buffer.from(JSON.stringify({
    type: 'user/message', data: { content: 'Another fictional island.' }
  }))));
  try { await callback({ root, file, other }); }
  finally {
    process.chdir(cwd);
    for (const [name, value] of Object.entries(previous)) {
      if (value === undefined) delete process.env[name]; else process.env[name] = value;
    }
    fs.rmSync(root, { recursive: true, force: true });
  }
}

test('requires Connection injection and registers only the protected Fetch route', () => {
  assert.deepEqual(inject, ['connection']);
  const plugin = createPlugin();
  assert.equal(plugin.route.path, '/api/chat-search');
  assert.deepEqual(plugin.route.methods, ['GET']);
  assert.equal(plugin.route.requestBody, 'buffered');
  assert.equal(typeof plugin.route.fetch, 'function');
  assert.equal(plugin.publicRegistrations, 0);
  plugin.dispose();
  assert.equal(plugin.disposed, true);
});

test('missing Connection, admit, Fetch registration or effect leaves no public fallback', () => {
  const publicRoute = () => { throw new Error('Public route forbidden'); };
  for (const ctx of [undefined, {}, { webServer: { register: publicRoute } },
    { connection: {} }, { connection: { admit() {} } },
    { connection: { fetch: { register: publicRoute } } },
    { connection: { admit() {}, fetch: { register: publicRoute } } }]) {
    assert.doesNotThrow(() => apply(ctx));
  }
});

for (const [label, admission, status] of [
  ['unauthenticated', { rejection: 401 }, 401],
  ['untrusted origin', { rejection: 403 }, 403],
  ['missing admission', undefined, 401],
  ['missing peer', {}, 401],
  ['rejection takes precedence over owner', { ...owner, rejection: 403 }, 403],
  ['non-owner principal', { peer: { principal: { kind: 'agent' } } }, 403],
  ['missing principal', { peer: {} }, 403],
  ['unrecognized denial', { rejection: 500 }, 401]
]) {
  test(`${label} is denied without touching session files`, async () => {
    await withNoFilesystemReads(async () => {
      const response = await createPlugin(() => admission).route.fetch(request());
      assert.equal(response.status, status);
      checkHeaders(response);
      assert.equal((await response.json()).ok, false);
    });
  });
}

test('authentication exceptions fail closed and hide their message', async () => {
  await withNoFilesystemReads(async () => {
    const response = await createPlugin(() => {
      throw new Error('C:\\private\\session.v4.jsonl.zstd contains fictional secret');
    }).route.fetch(request());
    assert.equal(response.status, 503);
    checkHeaders(response);
    assert.deepEqual(await response.json(), { ok: false, error: 'Authentication unavailable' });
  });
});

test('rejected asynchronous authentication fails closed', async () => {
  await withNoFilesystemReads(async () => {
    const response = await createPlugin(async () => { throw new Error('private'); }).route.fetch(request());
    assert.equal(response.status, 503);
    checkHeaders(response);
  });
});

test('authentication service disappearing after registration fails closed', async () => {
  await withNoFilesystemReads(async () => {
    const plugin = createPlugin();
    delete plugin.ctx.connection.admit;
    const response = await plugin.route.fetch(request());
    assert.equal(response.status, 503);
    checkHeaders(response);
  });
});

test('authentication receives original headers instead of the internal bridge origin', async () => {
  let supplied;
  const plugin = createPlugin((value) => { supplied = value; return { rejection: 401 }; });
  await plugin.route.fetch(request('fictional', { cookie: 'synthetic=test-only', 'sec-fetch-site': 'same-origin' }));
  assert.deepEqual(supplied, { headers: {
    cookie: 'synthetic=test-only', host: '127.0.0.1:32123',
    origin: 'http://127.0.0.1:32123', 'sec-fetch-site': 'same-origin'
  } });
});

test('invalid admission objects fail closed without leaking getter errors', async () => {
  await withNoFilesystemReads(async () => {
    const plugin = createPlugin(() => ({ peer: { get principal() { throw new Error('private'); } } }));
    const response = await plugin.route.fetch(request());
    assert.equal(response.status, 503);
    assert.deepEqual(await response.json(), { ok: false, error: 'Authentication unavailable' });
  });
});

test('owner searches synthetic zstd user and assistant messages with case-insensitive matching', async () => {
  await withSessions(async () => {
    const response = await createPlugin().route.fetch(request('fIcTiOnAl'));
    assert.equal(response.status, 200);
    checkHeaders(response);
    const result = await response.json();
    assert.equal(result.ok, true);
    assert.equal(result.totalMatches, 3);
    assert.equal(result.sessions.length, 2);
    const session = result.sessions.find((item) => item.sessionId === 'session-fictional-a');
    assert.equal(session.title, 'Synthetic garden');
    assert.equal(session.workspace, 'fictional workspace');
    assert.deepEqual(session.matches.map((item) => item.role), ['user', 'assistant']);
    assert.equal(session.matches[0].nodeKey, 'u11');
    assert.equal(session.matches[0].turn, 2);
  });
});

test('owner empty query returns no matches', async () => {
  await withSessions(async () => {
    const response = await createPlugin().route.fetch(request('   '));
    assert.deepEqual(await response.json(), { ok: true, totalMatches: 0, sessions: [] });
    checkHeaders(response);
  });
});

test('owner no-match query returns no sessions', async () => {
  await withSessions(async () => {
    const response = await createPlugin().route.fetch(request('not-in-any-synthetic-session'));
    assert.deepEqual(await response.json(), { ok: true, totalMatches: 0, sessions: [] });
  });
});

test('limit controls returned sessions while preserving the total match count', async () => {
  await withSessions(async () => {
    const response = await createPlugin().route.fetch(new Request(
      'http://dsh.internal/api/chat-search?q=fictional&limit=1', { headers: { host: '127.0.0.1:32123' } }
    ));
    const result = await response.json();
    assert.equal(result.sessions.length, 1);
    assert.equal(result.totalMatches, 3);
  });
});

test('malformed limit falls back to the default', async () => {
  await withSessions(async () => {
    const response = await createPlugin().route.fetch(new Request(
      'http://dsh.internal/api/chat-search?q=fictional&limit=NaN', { headers: { host: '127.0.0.1:32123' } }
    ));
    assert.equal((await response.json()).sessions.length, 2);
  });
});

test('search exceptions return a generic non-cacheable response', async () => {
  await withSessions(async ({ file }) => {
    const original = fs.existsSync;
    fs.existsSync = (value) => {
      if (value === file) throw new Error(`Sensitive path: ${file}; fictional session content`);
      return original(value);
    };
    try {
      const response = await createPlugin().route.fetch(request());
      assert.equal(response.status, 500);
      checkHeaders(response);
      assert.deepEqual(await response.json(), { ok: false, error: 'Search failed' });
    } finally { fs.existsSync = original; }
  });
});
