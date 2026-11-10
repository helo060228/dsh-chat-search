import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { test } from 'node:test';

// Execute the shipped client, not the unused navigation helper. All records are synthetic.
const source = fs.readFileSync(new URL('../lib/client.js', import.meta.url), 'utf8');

function createClock() {
  let now = 0;
  let sequence = 0;
  const tasks = new Map();
  const clock = {
    now: () => now,
    setTimeout(callback, delay = 0) {
      const id = ++sequence;
      tasks.set(id, { at: now + Number(delay), callback });
      return id;
    },
    clearTimeout(id) { tasks.delete(id); },
    async advance(duration) {
      const end = now + duration;
      for (let count = 0; count < 10000; count++) {
        // Flush async open/load continuations before choosing the next timer.
        for (let i = 0; i < 20; i++) await Promise.resolve();
        const next = [...tasks.entries()].filter(([, task]) => task.at <= end)
          .sort((a, b) => a[1].at - b[1].at || a[0] - b[0])[0];
        if (!next) { now = end; return; }
        now = next[1].at;
        tasks.delete(next[0]);
        next[1].callback();
      }
      throw new Error('Client timer loop did not settle');
    }
  };
  return clock;
}

function createRow(key, turn, text, role = 'user') {
  const attributes = new Map([
    ['data-chat-node-key', key], ['data-chat-anchor-key', key],
    ['data-chat-turn', String(turn)], ['data-chat-flow-kind', role]
  ]);
  return {
    textContent: text,
    classList: { contains: (value) => value === role },
    getAttribute: (name) => attributes.get(name) ?? null,
    setAttribute: (name, value) => attributes.set(name, value),
    removeAttribute: (name) => attributes.delete(name),
    offsetWidth: 100,
    isConnected: true,
    getBoundingClientRect: () => ({ top: 200, bottom: 270, height: 70 }),
    scrollIntoView() {}
  };
}

function createClient({ results, initialSession = 'source', rows = [], openSession, loadThrough,
  sessionSnapshot, chatSnapshot, referenceReady, sessionOpen, legacy = false, onRelease } = {}) {
  const clock = createClock();
  const hooks = [];
  const effects = [];
  const sessionListeners = new Set();
  const scrolls = [];
  let hookIndex = 0;
  let renderTimer;
  let component;
  let injected;
  let tree;
  let mounted = true;
  let current = initialSession;
  let renderedRows = rows;
  let renderedSession = initialSession;
  const bindings = new Map();
  const root = {
    isConnected: true,
    getAttribute: (name) => name === 'data-conversation-session' ? renderedSession : name === 'data-conversation-region' ? 'chat' : null,
    getClientRects: () => [{ top: 0, bottom: 700, height: 700 }],
    getBoundingClientRect: () => ({ top: 0, bottom: 700, height: 700 }),
    querySelectorAll: (selector) => selector.includes('data-chat-') ? renderedRows : [],
    querySelector: () => null
  };
  const environment = {
    clock, scrolls,
    setRows(value, sessionId = current) { renderedRows = value; renderedSession = sessionId; attachRows(); },
    setCurrent(value) {
      current = value;
      for (const listener of sessionListeners) listener();
      scheduleRender();
    },
    get current() { return current; },
    get rows() { return renderedRows; },
    root,
    get tree() { return tree; },
    render,
    unmount() {
      mounted = false;
      clock.clearTimeout(renderTimer);
      for (const hook of hooks) hook?.cleanup?.();
    },
    async search() {
      find(tree, (node) => node.props?.className === 'dsh_cs_launcher').props.onClick();
      await clock.advance(0);
      find(tree, (node) => node.props?.className === 'dsh_cs_input').props.onChange({ target: { value: 'needle' } });
      await clock.advance(300);
    },
    clickResult(index = 0) {
      const matches = findAll(tree, (node) => node.props?.className === 'dsh_cs_match_item');
      assert.ok(matches[index], 'Synthetic search result is rendered');
      matches[index].props.onClick();
    },
    async reopen() {
      find(tree, (node) => node.props?.className === 'dsh_cs_launcher').props.onClick();
      await clock.advance(0);
    }
  };
  function attachRows() {
    for (const row of renderedRows) {
      if (!row.parentElement) row.parentElement = root;
      row.scrollIntoView = () => {
        scrolls.push({ key: row.getAttribute('data-chat-node-key'), anchor: row.getAttribute('data-chat-anchor-key'), session: current, at: clock.now() });
      };
    }
  }
  attachRows();
  const document = {
    activeElement: null,
    querySelector: () => ({}), // Style is already installed by the host.
    querySelectorAll(selector) {
      if (selector.includes('data-conversation-content')) return [root];
      if (selector.includes('data-chat-')) return renderedRows;
      return [];
    }
  };
  function scheduleRender() {
    if (!mounted || renderTimer) return;
    renderTimer = clock.setTimeout(() => { renderTimer = null; render(); }, 0);
  }
  const React = {
    Fragment: 'fragment',
    createElement(type, props, ...children) { return { type, props: props || {}, children: children.flat(Infinity) }; },
    useState(initial) {
      const index = hookIndex++;
      if (!hooks[index]) hooks[index] = { value: typeof initial === 'function' ? initial() : initial };
      return [hooks[index].value, (value) => {
        hooks[index].value = typeof value === 'function' ? value(hooks[index].value) : value;
        scheduleRender();
      }];
    },
    useRef(value) {
      const index = hookIndex++;
      if (!hooks[index]) hooks[index] = { current: value };
      return hooks[index];
    },
    useEffect(callback, deps) {
      const index = hookIndex++;
      const previous = hooks[index];
      if (!previous || !deps || deps.some((value, i) => value !== previous.deps?.[i])) {
        effects.push(() => {
          previous?.cleanup?.();
          hooks[index] = { deps, cleanup: callback() };
        });
      }
    }
  };
  const sessions = {
    get current() { return current; },
    getSnapshot: () => ({ current }),
    subscribe(listener) { sessionListeners.add(listener); return () => sessionListeners.delete(listener); },
    setCurrent(id) { environment.setCurrent(id); },
    binding(id) {
      if (!bindings.has(id)) bindings.set(id, { id, session: {
        loadThrough: (seq) => loadThrough?.(seq, environment, id),
        open: () => sessionOpen?.(environment, id),
        getSnapshot: () => sessionSnapshot?.(environment, id) || { openState: 'open', loadingOlder: false }
      } });
      return bindings.get(id);
    }
  };
  if (!legacy) {
    sessions.list = {
      getSnapshot: () => ({ ids: [current], byId: { [current]: { retainedBy: { mainView: 1 } } }, phase: 'ready' }),
      subscribe(listener) { sessionListeners.add(listener); return () => sessionListeners.delete(listener); }
    };
    sessions.retain = (id) => ({
      ready: Promise.resolve(referenceReady ? referenceReady(environment, id) : sessions.binding(id).session.open()).then(() => sessions.binding(id)),
      release() { onRelease?.(id); }
    });
  }
  environment.sessions = sessions;
  const uiWorkspace = {
    openSession: (id) => openSession ? openSession(id, environment) : environment.setCurrent(id)
  };
  if (!legacy) {
    uiWorkspace.selection = {
      getSnapshot: () => current === undefined ? {} : { sessionId: current },
      subscribe(listener) { sessionListeners.add(listener); return () => sessionListeners.delete(listener); }
    };
  }
  environment.uiWorkspace = uiWorkspace;
  const uiConversation = {
    binding: (binding) => ({ target: () => ({
      getSnapshot: () => chatSnapshot?.(environment, binding.id) || { order: [], nodes: new Map() },
      subscribe: () => () => {}
    }) })
  };
  let exported;
  vm.runInNewContext(source, {
    window: {
      __ModuleLoader__: { load(definition) { exported = definition.factory((name) => {
        assert.equal(name, 'react'); return React;
      }); } },
      addEventListener() {}, removeEventListener() {}
    },
    document,
    Event,
    navigator: { platform: 'Win32' },
    setTimeout: clock.setTimeout,
    clearTimeout: clock.clearTimeout,
    requestAnimationFrame: (callback) => clock.setTimeout(callback, 16),
    cancelAnimationFrame: clock.clearTimeout,
    Date: class extends Date { static now() { return clock.now(); } },
    fetch: async () => ({ ok: true, json: async () => ({
      ok: true, totalMatches: results.reduce((sum, result) => sum + result.matches.length, 0), sessions: results
    }) }),
    console
  }, { filename: 'lib/client.js' });
  exported.apply({ sessions, uiWorkspace, uiConversation, slots: {
    inject(_name, factory) { factory(); },
    register(descriptor, value) { component = value; injected = descriptor.inject(); }
  } });
  function render() {
    hookIndex = 0;
    tree = component({ ...injected, useSessions: (selector) => selector(sessions.list?.getSnapshot() || sessions.getSnapshot()) });
    while (effects.length) effects.shift()();
  }
  render();
  environment.listenerCount = () => sessionListeners.size;
  return environment;
}

function findAll(node, predicate) {
  if (!node || typeof node !== 'object') return [];
  return [...(predicate(node) ? [node] : []), ...(node.children || []).flatMap((child) => findAll(child, predicate))];
}
function find(node, predicate) { return findAll(node, predicate)[0]; }
function result(sessionId = 'destination', key = 'target', turn = 3, eventSeq = 11) {
  return { sessionId, title: sessionId, matchCount: 1, matches: [
    { nodeKey: key, turn, eventSeq, role: 'user', snippet: 'needle in synthetic history' }
  ] };
}

// This is the reported first-click failure: a matching turn number also exists in the old chat.
test('one click waits for the destination chat instead of accepting the source turn', async () => {
  const sourceRow = createRow('source-key', 3, 'source turn');
  const targetRow = createRow('target', 3, 'needle in synthetic history');
  const client = createClient({
    results: [result()], rows: [sourceRow],
    openSession(id, env) {
      env.clock.setTimeout(() => { env.setCurrent(id); env.setRows([targetRow]); }, 700);
    }
  });
  await client.search();
  client.clickResult();
  await client.clock.advance(600);
  assert.equal(client.scrolls.length, 0, 'The source chat must never satisfy a destination jump');
  await client.clock.advance(2500);
  assert.ok(client.scrolls.some((entry) => entry.key === 'target' && entry.session === 'destination'),
    'The initial click must eventually locate the destination message');
  client.unmount();
});

test('history loading is awaited before committing a message jump', async () => {
  let historyLoaded = false;
  const targetRow = createRow('target', 3, 'needle in synthetic history');
  const client = createClient({
    results: [result()],
    openSession(id, env) { env.setCurrent(id); env.setRows([targetRow]); },
    loadThrough(_seq, env) {
      return new Promise((resolve) => env.clock.setTimeout(() => { historyLoaded = true; resolve(); }, 700));
    }
  });
  await client.search();
  client.clickResult();
  await client.clock.advance(500);
  assert.equal(historyLoaded, false);
  assert.equal(client.scrolls.length, 0, 'Do not report success while loadThrough is pending');
  await client.clock.advance(2500);
  assert.ok(client.scrolls.some((entry) => entry.key === 'target'));
  client.unmount();
});

test('a pending jump is cancelled when the overlay unmounts', async () => {
  const client = createClient({ results: [result()], openSession(id, env) { env.setCurrent(id); } });
  await client.search();
  client.clickResult();
  await client.clock.advance(200);
  client.unmount();
  client.setRows([createRow('target', 3, 'needle in synthetic history')]);
  await client.clock.advance(12000);
  assert.equal(client.scrolls.length, 0, 'Disposed overlays must not keep scrolling another chat');
});

test('waits for the first session open and an in-flight older page before loadThrough', async () => {
  let state = { openState: 'loading', loadingOlder: false };
  let loaded = 0;
  let released = 0;
  const client = createClient({
    results: [result()],
    openSession(id, env) { env.setCurrent(id); env.setRows([]); },
    referenceReady(env) {
      return new Promise((resolve) => env.clock.setTimeout(() => {
        state = { openState: 'open', loadingOlder: true };
        resolve();
        env.clock.setTimeout(() => { state.loadingOlder = false; }, 400);
      }, 700));
    },
    sessionSnapshot: () => state,
    loadThrough(seq, env) {
      assert.equal(seq, 11);
      assert.equal(state.openState, 'open');
      assert.equal(state.loadingOlder, false);
      loaded++;
      env.setRows([createRow('target', 3, 'needle in synthetic history')]);
    },
    onRelease() { released++; }
  });
  await client.search();
  client.clickResult();
  await client.clock.advance(900);
  assert.equal(loaded, 0);
  await client.clock.advance(2500);
  assert.equal(loaded, 1);
  assert.equal(released, 1);
  assert.ok(client.scrolls.some((entry) => entry.key === 'target'));
  assert.equal(client.listenerCount(), 0, 'Selection subscription is released after success');
  client.unmount();
});

for (const [label, hit, node] of [
  ['user ID', result(), { key: '13:input-messagetarget', id: 'target', kind: 'user', data: { seq: 11 } }],
  ['user event sequence', result(), { key: '13:input-messageactual', id: 'actual', kind: 'user', data: { seq: 11 } }],
  ...['steering', 'context', 'turn-trigger'].map((kind) => [
    `${kind} input`, result(), { key: `13:input-message${kind}`, id: 'target', kind, data: { seq: 11 } }
  ]),
  ['assistant final message', { ...result(), matches: [{ ...result().matches[0], role: 'assistant' }] },
    { key: '14:assistant-step3:1', id: '3:1', kind: 'assistant-step', data: { finalNode: { seq: 11, messageId: 'target' } } }]
]) {
  test(`maps a raw ${label} to the rendered Chat key`, async () => {
    const row = createRow(node.key, 3, 'needle in synthetic history', node.kind);
    const client = createClient({
      results: [hit],
      openSession(id, env) { env.setCurrent(id); env.setRows([row]); },
      chatSnapshot: () => ({ order: [node.key], nodes: new Map([[node.key, node]]) })
    });
    await client.search();
    client.clickResult();
    await client.clock.advance(2200);
    assert.equal(row.getAttribute('data-chat-search-target'), 'true');
    assert.ok(client.scrolls.every((entry) => entry.key === node.key));
    client.unmount();
  });
}

test('an assistant text hit selects the response instead of the earlier reasoning seat', async () => {
  const key = '14:assistant-step3:1';
  const reasoning = createRow(key, 3, 'synthetic internal reasoning', 'assistant-step');
  reasoning.setAttribute('data-chat-anchor-key', JSON.stringify([key, 'reasoning']));
  reasoning.setAttribute('data-chat-group-part', 'reasoning');
  const response = createRow(key, 3, 'needle in synthetic history', 'assistant-step');
  response.setAttribute('data-chat-group-part', 'response');
  const hit = result();
  hit.matches[0].role = 'assistant';
  const node = { key, id: '3:1', kind: 'assistant-step', data: { finalNode: { seq: 11, messageId: 'target' } } };
  const client = createClient({
    results: [hit],
    openSession(id, env) { env.setCurrent(id); env.setRows([reasoning, response]); },
    chatSnapshot: () => ({ order: [key], nodes: new Map([[key, node]]) })
  });
  await client.search();
  client.clickResult();
  await client.clock.advance(2200);
  assert.equal(response.getAttribute('data-chat-search-target'), 'true');
  assert.equal(reasoning.getAttribute('data-chat-search-target'), null);
  assert.ok(client.scrolls.length > 0);
  assert.ok(client.scrolls.every((entry) => entry.anchor === key));
  client.unmount();
});

test('a precise anchor wins over another seat sharing its node key', async () => {
  const key = 'shared-key';
  const shared = createRow(key, 3, 'needle in synthetic history', 'assistant-step');
  shared.setAttribute('data-chat-anchor-key', 'other-seat');
  shared.setAttribute('data-chat-group-part', 'response');
  const exact = createRow(key, 3, 'needle in synthetic history', 'assistant-step');
  const hit = result('destination', key);
  hit.matches[0].role = 'assistant';
  const client = createClient({
    results: [hit],
    openSession(id, env) { env.setCurrent(id); env.setRows([shared, exact]); }
  });
  await client.search();
  client.clickResult();
  await client.clock.advance(2200);
  assert.equal(exact.getAttribute('data-chat-search-target'), 'true');
  assert.equal(shared.getAttribute('data-chat-search-target'), null);
  client.unmount();
});

test('reveals each nested host fold and re-queries the replacement message seat', async () => {
  const events = [];
  let outerOpen = false;
  let innerOpen = false;
  const hiddenRow = createRow('target', 3, 'needle in synthetic history');
  const replacement = createRow('target', 3, 'needle in synthetic history');
  const client = createClient({
    results: [result()],
    openSession(id, env) { env.setCurrent(id); env.setRows([hiddenRow]); }
  });
  const outer = {
    parentElement: client.root,
    getAttribute: (name) => name === 'hidden' && !outerOpen ? 'until-found' : null,
    dispatchEvent(event) {
      assert.equal(event.type, 'beforematch');
      assert.equal(event.bubbles, false);
      events.push('outer');
      client.clock.setTimeout(() => { outerOpen = true; }, 16);
    }
  };
  const inner = {
    parentElement: outer,
    getAttribute: (name) => name === 'hidden' && !innerOpen ? 'until-found' : null,
    dispatchEvent(event) {
      assert.equal(event.type, 'beforematch');
      events.push('inner');
      client.clock.setTimeout(() => {
        innerOpen = true;
        hiddenRow.isConnected = false;
        client.setRows([replacement]);
      }, 16);
    }
  };
  hiddenRow.parentElement = inner;
  hiddenRow.getBoundingClientRect = () => ({ top: 0, bottom: 0, height: 0 });
  await client.search();
  client.clickResult();
  await client.clock.advance(2200);
  assert.deepEqual(events, ['outer', 'inner']);
  assert.equal(outerOpen && innerOpen, true);
  assert.equal(hiddenRow.getAttribute('data-chat-search-target'), null);
  assert.equal(replacement.getAttribute('data-chat-search-target'), 'true');
  client.unmount();
});

test('a transformed input needs an exact identity, not just a matching turn and snippet', async () => {
  const key = '13:input-messagedifferent';
  const row = createRow(key, 3, 'needle in synthetic history', 'steering');
  const node = { key, id: 'different', kind: 'steering', location: { turn: { turn: 3 } }, data: { seq: 99, content: 'needle in synthetic history' } };
  const client = createClient({
    results: [result()],
    openSession(id, env) { env.setCurrent(id); env.setRows([row]); },
    chatSnapshot: () => ({ order: [key], nodes: new Map([[key, node]]) })
  });
  await client.search();
  client.clickResult();
  await client.clock.advance(15500);
  assert.equal(client.scrolls.length, 0);
  assert.equal(row.getAttribute('data-chat-search-target'), null);
  client.unmount();
});

test('re-aligns after a late initial tail restore instead of declaring early success', async () => {
  let top = 1400;
  let following = true;
  let writes = 0;
  const row = createRow('target', 3, 'needle in synthetic history');
  row.getBoundingClientRect = () => ({ top, bottom: top + 70, height: 70 });
  const scroller = { scrollTop: 800, scrollHeight: 5000, clientHeight: 700,
    getBoundingClientRect: () => ({ top: 0, bottom: 700 }) };
  const client = createClient({
    results: [result()],
    openSession(id, env) {
      env.setCurrent(id); env.setRows([row]);
      row.scrollIntoView = () => { writes++; top = 250; scroller.scrollTop = 200; };
      env.clock.setTimeout(() => { top = 1400; scroller.scrollTop = 4300; }, 350);
      env.clock.setTimeout(() => { following = false; }, 850);
    }
  });
  client.root.querySelector = (selector) => selector === '[data-conversation-scroll]' ? scroller : following ? {} : null;
  await client.search();
  client.clickResult();
  await client.clock.advance(700);
  assert.notEqual(row.getAttribute('data-chat-search-target'), 'true', 'Tail restore is not a completed jump');
  await client.clock.advance(1800);
  assert.ok(writes >= 2, 'The original click must re-align a displaced landing');
  assert.equal(row.getAttribute('data-chat-search-target'), 'true');
  assert.equal(top, 250);
  client.unmount();
});

test('new clicks replace pending jumps and never return to the old result', async () => {
  let released = 0;
  const client = createClient({
    results: [result('first', 'one'), result('second', 'two')],
    openSession(id, env) { env.setCurrent(id); env.setRows([]); },
    loadThrough(_seq, env, id) {
      return new Promise((resolve) => env.clock.setTimeout(() => {
        if (id === 'second') env.setRows([createRow('two', 3, 'needle in synthetic history')]);
        resolve();
      }, id === 'first' ? 1500 : 100));
    },
    onRelease() { released++; }
  });
  await client.search();
  client.clickResult(0);
  await client.clock.advance(150);
  await client.reopen();
  client.clickResult(1);
  await client.clock.advance(3500);
  assert.ok(client.scrolls.some((entry) => entry.key === 'two'));
  assert.ok(client.scrolls.every((entry) => entry.key !== 'one'));
  assert.equal(released, 2);
  client.unmount();
});

test('leaving the destination cancels a pending history completion', async () => {
  const row = createRow('target', 3, 'needle in synthetic history');
  const client = createClient({
    results: [result()],
    openSession(id, env) { env.setCurrent(id); env.setRows([]); },
    loadThrough(_seq, env) { return new Promise((resolve) => env.clock.setTimeout(resolve, 700)); }
  });
  await client.search();
  client.clickResult();
  await client.clock.advance(100);
  client.setCurrent('other');
  client.setRows([row], 'destination'); // A resident embedded occurrence is not permission to steal focus.
  await client.clock.advance(2500);
  assert.equal(client.scrolls.length, 0);
  assert.equal(client.listenerCount(), 0);
  client.unmount();
});

test('an unavailable node times out visibly rather than selecting an unrelated turn', async () => {
  const row = createRow('different', 3, 'different message in the same turn');
  const client = createClient({ results: [result()], openSession(id, env) { env.setCurrent(id); env.setRows([row]); } });
  await client.search();
  client.clickResult();
  await client.clock.advance(15500);
  assert.equal(client.scrolls.length, 0);
  const status = find(client.tree, (node) => node.props?.role === 'status');
  assert.ok(status.children.join('').includes('定位未完成'));
  assert.equal(client.listenerCount(), 0);
  client.unmount();
});

test('already-open and legacy sessions also use the cancellable single-click path', async () => {
  let opened = 0;
  const row = createRow('target', 3, 'needle in synthetic history');
  const client = createClient({
    legacy: true, initialSession: 'destination', rows: [row], results: [result()],
    openSession() { opened++; }
  });
  await client.search();
  client.clickResult();
  await client.clock.advance(1800);
  assert.equal(opened, 0);
  assert.equal(row.getAttribute('data-chat-search-target'), 'true');
  client.unmount();
});
