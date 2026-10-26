const DEFAULT_TIMEOUT_MS = 8000;
const DEFAULT_INTERVAL_MS = 100;

function cssEscape(value) {
  if (typeof CSS !== 'undefined' && CSS && typeof CSS.escape === 'function') {
    return CSS.escape(String(value));
  }
  return String(value).replace(/[^a-zA-Z0-9_-]/g, function (ch) {
    return '\\' + ch.charCodeAt(0).toString(16) + ' ';
  });
}

function firstFunction(target, names) {
  if (!target) return null;
  for (var i = 0; i < names.length; i++) {
    var candidate = target[names[i]];
    if (typeof candidate === 'function') return candidate.bind(target);
  }
  return null;
}

export function findSessionRow(document, sessionId) {
  if (!document || !sessionId) return null;
  var rows = document.querySelectorAll('[data-row-key], [data-session-id], [data-session]');
  var wanted = String(sessionId);
  for (var i = 0; i < rows.length; i++) {
    var row = rows[i];
    if (row.getAttribute('data-row-key') === 'session:' + wanted ||
        row.getAttribute('data-session-id') === wanted ||
        row.getAttribute('data-session') === wanted) return row;
  }
  return null;
}

export function findMessageRow(document, nodeKey, turn, role, queryText) {
  if (!document) return null;
  var expectedKinds = role === 'assistant' ? ['assistant-step', 'assistant'] : role ? [role] : [];
  var rows = document.querySelectorAll('[data-chat-anchor-key], [data-chat-node-key]');
  var nodeMatch = null;
  for (var i = 0; i < rows.length; i++) {
    var row = rows[i];
    var matchesKey = nodeKey && (row.getAttribute('data-chat-anchor-key') === String(nodeKey) || row.getAttribute('data-chat-node-key') === String(nodeKey));
    if (matchesKey) {
      nodeMatch = row;
      var kind = row.getAttribute('data-chat-flow-kind');
      if (!role || expectedKinds.indexOf(kind) !== -1 || row.classList.contains(role)) {
        if (!queryText || String(row.textContent || '').toLowerCase().indexOf(String(queryText).toLowerCase()) !== -1) return row;
      }
    }
  }
  if (nodeMatch && !role && !queryText) return nodeMatch;
  if (turn !== undefined && turn !== null && String(turn) !== '') {
    var turnRows = document.querySelectorAll('[data-chat-turn]');
    var firstTurn = null;
    var wanted = queryText ? String(queryText).toLowerCase() : '';
    for (var j = 0; j < turnRows.length; j++) {
      var candidate = turnRows[j];
      if (candidate.getAttribute('data-chat-turn') !== String(turn)) continue;
      if (!firstTurn) firstTurn = candidate;
      var candidateKind = candidate.getAttribute('data-chat-flow-kind') || '';
      var sameRole = !role || expectedKinds.indexOf(candidateKind) !== -1 || candidate.classList.contains(role);
      var sameText = !wanted || String(candidate.textContent || '').toLowerCase().indexOf(wanted) !== -1;
      if (sameRole && sameText) return candidate;
    }
    return firstTurn;
  }
  return nodeMatch;
}

export function scrollAndFlash(document, nodeKey, turn, role, queryText) {
  var target = findMessageRow(document, nodeKey, turn, role, queryText);
  if (!target) return false;
  try { target.scrollIntoView({ behavior: 'smooth', block: 'center' }); }
  catch (_) { target.scrollIntoView(true); }
  target.removeAttribute('data-chat-search-target');
  void target.offsetWidth;
  target.setAttribute('data-chat-search-target', 'true');
  setTimeout(function () { target.removeAttribute('data-chat-search-target'); }, 2800);
  return true;
}

export function waitFor(document, predicate, timeoutMs = DEFAULT_TIMEOUT_MS, intervalMs = DEFAULT_INTERVAL_MS) {
  return new Promise(function (resolve) {
    var started = Date.now();
    function check() {
      var value = predicate();
      if (value) { resolve(value); return; }
      if (Date.now() - started >= timeoutMs) { resolve(null); return; }
      setTimeout(check, intervalMs);
    }
    check();
  });
}

export function createSessionNavigator(options) {
  var document = options.document;
  var sessions = options.sessions;
  var onStatus = typeof options.onStatus === 'function' ? options.onStatus : function () {};

  async function selectSession(sessionId) {
    if (!sessionId) return false;
    var current = sessions && typeof sessions.current === 'string' ? sessions.current : undefined;
    if (current === sessionId && scrollAndFlash(document, options.nodeKey, options.turn, options.role, options.queryText)) return true;

    var direct = firstFunction(sessions, ['select', 'open', 'navigate', 'setCurrent', 'switchTo']);
    if (direct) {
      try {
        await Promise.resolve(direct(sessionId));
        if (await waitFor(document, function () { return scrollAndFlash(document, options.nodeKey, options.turn, options.role, options.queryText) || findSessionRow(document, sessionId); })) {
          return true;
        }
      } catch (_) {}
    }

    var row = findSessionRow(document, sessionId);
    if (!row) {
      var workspaces = document.querySelectorAll('[data-row-key^="workspace:"][aria-expanded="false"]');
      for (var i = 0; i < workspaces.length; i++) workspaces[i].click();
      var overflow = document.querySelectorAll('[data-row-key^="overflow:"][aria-expanded="false"]');
      for (var j = 0; j < overflow.length; j++) overflow[j].click();
      row = await waitFor(document, function () { return findSessionRow(document, sessionId); }, 2500);
    }
    if (row) {
      row.click();
      if (await waitFor(document, function () { return scrollAndFlash(document, options.nodeKey, options.turn, options.role, options.queryText); }, DEFAULT_TIMEOUT_MS)) return true;
    }
    onStatus('未能打开会话 ' + sessionId + '。请在左侧会话列表中展开对应工作区后重试。');
    return false;
  }

  return { selectSession: selectSession };
}
