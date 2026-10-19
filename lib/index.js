import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';

export const name = 'dsh-chat-search';
export const inject = ['webServer'];

const ZSTD_MAGIC = 4247762216; // 0xFD2FB528
const sessionCache = new Map();

function scanZstdFrames(buf) {
  const frames = [];
  let i = 0;
  while (i + 4 <= buf.length) {
    if (buf.readUInt32LE(i) === ZSTD_MAGIC) {
      if (frames.length > 0) frames[frames.length - 1].end = i;
      frames.push({ start: i, end: buf.length });
      i += 4;
    } else {
      i++;
    }
  }
  return frames;
}

function parseSessionFile(filePath) {
  const buf = fs.readFileSync(filePath);
  const frames = scanZstdFrames(buf);
  const events = [];
  for (const frame of frames) {
    const chunk = buf.subarray(frame.start, frame.end);
    try {
      const decompressed = zlib.zstdDecompressSync(chunk);
      const str = decompressed.toString('utf8');
      const lines = str.split('\n');
      for (const line of lines) {
        if (!line.trim()) continue;
        try {
          events.push(JSON.parse(line));
        } catch (e) {}
      }
    } catch (e) {}
  }
  return events;
}

function getSessionEvents(filePath, mtimeMs) {
  const cached = sessionCache.get(filePath);
  if (cached && cached.mtimeMs === mtimeMs) {
    return cached.events;
  }
  const events = parseSessionFile(filePath);
  sessionCache.set(filePath, { mtimeMs, events });
  return events;
}

function findSessionsRoots() {
  const candidates = [];
  if (process.env.DSH_HOME) {
    candidates.push(path.join(process.env.DSH_HOME, 'sessions'));
  }
  const appData = process.env.APPDATA || (process.platform === 'darwin' ? path.join(process.env.HOME || '', 'Library/Application Support') : path.join(process.env.HOME || '', '.config'));
  candidates.push(path.join(appData, 'dsh-desktop', 'harness', 'sessions'));
  candidates.push(path.join(process.cwd(), 'sessions'));

  const valid = [];
  for (const c of candidates) {
    try {
      if (c && fs.existsSync(c) && !valid.includes(c)) {
        valid.push(c);
      }
    } catch (e) {}
  }
  return valid;
}

function decodeWorkspaceName(dirName) {
  let wsName = dirName;
  if (wsName.startsWith('--') && wsName.endsWith('--')) {
    wsName = wsName.slice(2, -2).replace(/~([0-9A-Fa-f]{4})/g, (_, hex) => String.fromCharCode(parseInt(hex, 16))).replace(/-/g, '/');
  }
  return wsName;
}

function executeSearch(roots, query, limit = 50) {
  if (!query || !query.trim()) {
    return { ok: true, totalMatches: 0, sessions: [] };
  }
  const q = query.toLowerCase();
  const results = [];
  let totalMatches = 0;
  const seenSessions = new Set();

  for (const root of roots) {
    let wsEntries = [];
    try {
      wsEntries = fs.readdirSync(root, { withFileTypes: true });
    } catch (e) {
      continue;
    }

    for (const wsEnt of wsEntries) {
      if (!wsEnt.isDirectory()) continue;
      const wsPath = path.join(root, wsEnt.name);
      const wsDisplayName = decodeWorkspaceName(wsEnt.name);

      let sessionDirs = [];
      try {
        sessionDirs = fs.readdirSync(wsPath, { withFileTypes: true });
      } catch (e) {
        continue;
      }

      for (const sDir of sessionDirs) {
        if (!sDir.isDirectory()) continue;
        const sessionId = sDir.name;
        if (seenSessions.has(sessionId)) continue;

        const sFile = path.join(wsPath, sessionId, 'session.v4.jsonl.zstd');
        if (!fs.existsSync(sFile)) continue;

        let stat;
        try {
          stat = fs.statSync(sFile);
        } catch (e) {
          continue;
        }

        const events = getSessionEvents(sFile, stat.mtimeMs);
        let title = sessionId;
        const matches = [];

        for (const ev of events) {
          if (ev.type === 'session/title' && ev.data && ev.data.title) {
            title = ev.data.title;
          } else if (ev.type === 'user/message' && ev.data) {
            let text = '';
            if (Array.isArray(ev.data.content)) {
              text = ev.data.content.filter(c => c.type === 'text').map(c => c.text).join('\n');
            } else if (typeof ev.data.content === 'string') {
              text = ev.data.content;
            }
            if (text) {
              const idx = text.toLowerCase().indexOf(q);
              if (idx !== -1) {
                const snippetStart = Math.max(0, idx - 35);
                const snippetEnd = Math.min(text.length, idx + query.length + 55);
                const snippet = (snippetStart > 0 ? '...' : '') + text.slice(snippetStart, snippetEnd) + (snippetEnd < text.length ? '...' : '');
                matches.push({
                  role: 'user',
                  turn: ev.data.turn || ev.turn || 0,
                  nodeKey: ev.data.id || String(ev.seq || ''),
                  snippet,
                  timestamp: ev.timestamp || stat.mtimeMs
                });
                totalMatches++;
              }
            }
          } else if (ev.type === 'assistant/message' && ev.data && ev.data.message) {
            let text = '';
            const msg = ev.data.message;
            if (Array.isArray(msg.content)) {
              text = msg.content.filter(c => c.type === 'text').map(c => c.text).join('\n');
            } else if (typeof msg.content === 'string') {
              text = msg.content;
            }
            if (text) {
              const idx = text.toLowerCase().indexOf(q);
              if (idx !== -1) {
                const snippetStart = Math.max(0, idx - 35);
                const snippetEnd = Math.min(text.length, idx + query.length + 55);
                const snippet = (snippetStart > 0 ? '...' : '') + text.slice(snippetStart, snippetEnd) + (snippetEnd < text.length ? '...' : '');
                matches.push({
                  role: 'assistant',
                  turn: ev.data.turn || ev.turn || 0,
                  nodeKey: msg.id || String(ev.seq || ''),
                  snippet,
                  timestamp: ev.timestamp || stat.mtimeMs
                });
                totalMatches++;
              }
            }
          }
        }

        if (matches.length > 0) {
          seenSessions.add(sessionId);
          results.push({
            sessionId,
            title,
            workspace: wsDisplayName,
            updatedAt: stat.mtimeMs,
            matchCount: matches.length,
            matches
          });
        }
      }
    }
  }

  results.sort((a, b) => b.updatedAt - a.updatedAt);
  const truncated = results.slice(0, limit);
  return { ok: true, totalMatches, sessions: truncated };
}

export function apply(ctx) {
  try {
    if (!ctx || !ctx.webServer || typeof ctx.webServer.register !== 'function') {
      return;
    }

    const roots = findSessionsRoots();

    ctx.effect(() => {
      const route = {
        kind: 'exact',
        path: '/api/chat-search',
        handler: async (req, res) => {
          try {
            const url = new URL(req.url, 'http://127.0.0.1');
            const q = url.searchParams.get('q') || '';
            const limit = parseInt(url.searchParams.get('limit') || '50', 10);
            const data = executeSearch(roots, q, limit);

            res.writeHead(200, {
              'Content-Type': 'application/json; charset=utf-8',
              'Access-Control-Allow-Origin': '*'
            });
            res.end(JSON.stringify(data));
          } catch (err) {
            res.writeHead(500, {
              'Content-Type': 'application/json; charset=utf-8',
              'Access-Control-Allow-Origin': '*'
            });
            res.end(JSON.stringify({ ok: false, error: String(err && err.message ? err.message : err) }));
          }
        }
      };

      const unregister = ctx.webServer.register(route);
      return () => {
        try {
          unregister();
        } catch (e) {}
      };
    }, 'dsh-chat-search: webserver route');
  } catch (err) {
    console.error('[dsh-chat-search] apply error:', err);
  }
}
