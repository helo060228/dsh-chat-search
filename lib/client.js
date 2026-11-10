/**
 * dsh-chat-search 客户端插件
 * 
 * 功能：
 * 1. 全局跨会话搜索：在所有历史任务会话中搜索关键词，展示匹配会话与上下文片段，点击一键切换并锁定。
 * 2. 当前会话内搜索：在当前正在进行的对话中实时检索，支持列表查看与上下处快速跳转。
 * 3. 上下文精准锁定：平滑滚动到目标消息，并伴随脉冲发光动效高亮，秒级锁定。
 * 4. 跨会话导航：通过 DSH 会话列表或 sessions 导航 API 打开命中的会话，等待消息 DOM 挂载后再定位。
 * 5. 快捷键支持：Ctrl+Shift+F / Alt+F 唤起搜索，Esc 关闭，Enter/Shift+Enter 上下跳转。
 */

window.__ModuleLoader__.load({
  id: 'dsh-chat-search',
  factory: function (require) {
    var module = { exports: {} };
    var exports = module.exports;
    var React = require('react');
    var createElement = React.createElement;

    // ------------------------------------------------------------------
    // 样式注入：完美契合 DSH 深色与浅色主题变量
    // ------------------------------------------------------------------
    var CSS = [
      '/* 浮动搜索启动球 */',
      '.dsh_cs_launcher {',
      '  position: fixed;',
      '  right: 20px;',
      '  bottom: 82px;',
      '  width: 40px;',
      '  height: 40px;',
      '  border-radius: 20px;',
      '  background: var(--dsw-alias-bg-base, #1e1f22);',
      '  border: 1px solid var(--dsw-alias-border-l2, rgba(255,255,255,0.15));',
      '  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.35);',
      '  display: flex;',
      '  align-items: center;',
      '  justify-content: center;',
      '  cursor: pointer;',
      '  z-index: 1000;',
      '  color: var(--dsw-alias-label-secondary, #94a3b8);',
      '  transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1);',
      '  user-select: none;',
      '}',
      '.dsh_cs_launcher:hover {',
      '  transform: scale(1.08);',
      '  color: var(--dsw-alias-button-info-fill, #3b82f6);',
      '  border-color: var(--dsw-alias-button-info-fill, #3b82f6);',
      '  box-shadow: 0 6px 20px rgba(59, 130, 246, 0.3);',
      '}',
      '.dsh_cs_launcher svg { width: 20px; height: 20px; }',

      '.dsh_cs_jump_status {',
      '  position: fixed; right: 20px; bottom: 134px; z-index: 2100;',
      '  max-width: min(420px, calc(100vw - 40px)); padding: 10px 14px;',
      '  border-radius: 8px; background: var(--dsw-alias-bg-base, #1e1f22);',
      '  color: var(--dsw-alias-label-primary, #ddd); font-size: 13px;',
      '  border: 1px solid var(--dsw-alias-border-l2, rgba(255,255,255,0.15));',
      '}',
      '/* 模态遮罩层 */',
      '.dsh_cs_mask {',
      '  position: fixed;',
      '  inset: 0;',
      '  background: rgba(0, 0, 0, 0.48);',
      '  backdrop-filter: blur(4px);',
      '  z-index: 2000;',
      '  display: flex;',
      '  align-items: flex-start;',
      '  justify-content: center;',
      '  padding-top: 70px;',
      '  animation: dsh_cs_fade 0.15s ease-out;',
      '}',

      '/* 搜索面板卡片 */',
      '.dsh_cs_modal {',
      '  width: 720px;',
      '  max-width: calc(100vw - 32px);',
      '  max-height: 82vh;',
      '  background: var(--dsw-alias-bg-base, #18191c);',
      '  border: 1px solid var(--dsw-alias-border-l2, rgba(255,255,255,0.14));',
      '  border-radius: 14px;',
      '  box-shadow: 0 16px 40px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,255,255,0.05);',
      '  display: flex;',
      '  flex-direction: column;',
      '  overflow: hidden;',
      '  animation: dsh_cs_pop 0.2s cubic-bezier(0.16, 1, 0.3, 1);',
      '}',

      '/* 头部输入框区域 */',
      '.dsh_cs_header {',
      '  padding: 14px 16px 12px;',
      '  border-bottom: 1px solid var(--dsw-alias-border-l1, rgba(255,255,255,0.08));',
      '  display: flex;',
      '  flex-direction: column;',
      '  gap: 10px;',
      '  background: var(--dsw-alias-bg-base, #18191c);',
      '}',
      '.dsh_cs_input_row {',
      '  display: flex;',
      '  align-items: center;',
      '  gap: 10px;',
      '  position: relative;',
      '}',
      '.dsh_cs_search_icon {',
      '  flex: none;',
      '  color: var(--dsw-alias-label-tertiary, #64748b);',
      '  display: flex;',
      '  align-items: center;',
      '}',
      '.dsh_cs_search_icon svg { width: 20px; height: 20px; }',
      '.dsh_cs_input {',
      '  flex: auto;',
      '  min-width: 0;',
      '  background: transparent;',
      '  border: 0;',
      '  outline: none;',
      '  font-size: 15px;',
      '  color: var(--dsw-alias-label-primary, #f1f5f9);',
      '  line-height: 22px;',
      '}',
      '.dsh_cs_input::placeholder { color: var(--dsw-alias-label-tertiary, #64748b); }',
      '.dsh_cs_clear_btn {',
      '  border: 0;',
      '  background: var(--dsw-alias-interactive-bg-hover, rgba(255,255,255,0.08));',
      '  color: var(--dsw-alias-label-secondary, #94a3b8);',
      '  cursor: pointer;',
      '  width: 22px;',
      '  height: 22px;',
      '  border-radius: 11px;',
      '  display: grid;',
      '  place-items: center;',
      '  font-size: 12px;',
      '  padding: 0;',
      '  transition: all 0.15s ease;',
      '}',
      '.dsh_cs_clear_btn:hover { color: var(--dsw-alias-label-primary, #fff); }',

      '/* Tab 标签栏 */',
      '.dsh_cs_tabs {',
      '  display: flex;',
      '  align-items: center;',
      '  gap: 8px;',
      '}',
      '.dsh_cs_tab {',
      '  border: 0;',
      '  background: transparent;',
      '  padding: 5px 12px;',
      '  border-radius: 6px;',
      '  font-size: 12.5px;',
      '  font-weight: 500;',
      '  color: var(--dsw-alias-label-secondary, #94a3b8);',
      '  cursor: pointer;',
      '  transition: all 0.15s ease;',
      '  display: flex;',
      '  align-items: center;',
      '  gap: 6px;',
      '}',
      '.dsh_cs_tab:hover {',
      '  background: var(--dsw-alias-interactive-bg-hover, rgba(255,255,255,0.06));',
      '  color: var(--dsw-alias-label-primary, #fff);',
      '}',
      '.dsh_cs_tab[data-active="true"] {',
      '  background: var(--dsw-alias-button-info-fill, #3b82f6);',
      '  color: #ffffff;',
      '  font-weight: 600;',
      '}',
      '.dsh_cs_tab_badge {',
      '  background: rgba(255,255,255,0.18);',
      '  padding: 1px 6px;',
      '  border-radius: 10px;',
      '  font-size: 11px;',
      '}',
      '.dsh_cs_tab[data-active="true"] .dsh_cs_tab_badge {',
      '  background: rgba(0,0,0,0.25);',
      '}',

      '/* 状态与统计栏 */',
      '.dsh_cs_subbar {',
      '  padding: 6px 16px;',
      '  font-size: 11.5px;',
      '  color: var(--dsw-alias-label-tertiary, #64748b);',
      '  background: rgba(0,0,0,0.12);',
      '  border-bottom: 1px solid var(--dsw-alias-border-l1, rgba(255,255,255,0.05));',
      '  display: flex;',
      '  align-items: center;',
      '  justify-content: space-between;',
      '}',
      '.dsh_cs_nav_btns { display: flex; align-items: center; gap: 4px; }',
      '.dsh_cs_nav_btn {',
      '  border: 1px solid var(--dsw-alias-border-l2, rgba(255,255,255,0.1));',
      '  background: var(--dsw-alias-bg-base, #1e1f22);',
      '  color: var(--dsw-alias-label-primary, #f1f5f9);',
      '  border-radius: 4px;',
      '  padding: 2px 8px;',
      '  font-size: 11px;',
      '  cursor: pointer;',
      '  transition: all 0.15s ease;',
      '}',
      '.dsh_cs_nav_btn:hover:not(:disabled) {',
      '  background: var(--dsw-alias-interactive-bg-hover, rgba(255,255,255,0.1));',
      '}',
      '.dsh_cs_nav_btn:disabled { opacity: 0.4; cursor: default; }',

      '/* 搜索结果列表容器 */',
      '.dsh_cs_body {',
      '  flex: auto;',
      '  overflow-y: auto;',
      '  padding: 10px 14px;',
      '  display: flex;',
      '  flex-direction: column;',
      '  gap: 10px;',
      '  scrollbar-width: thin;',
      '  scrollbar-color: var(--dsw-alias-border-l3, rgba(255,255,255,0.2)) transparent;',
      '}',

      '/* 会话组卡片 */',
      '.dsh_cs_session_card {',
      '  background: rgba(255, 255, 255, 0.025);',
      '  border: 1px solid var(--dsw-alias-border-l1, rgba(255,255,255,0.08));',
      '  border-radius: 8px;',
      '  overflow: hidden;',
      '  transition: border-color 0.15s ease;',
      '}',
      '.dsh_cs_session_card:hover {',
      '  border-color: var(--dsw-alias-border-l2, rgba(255,255,255,0.18));',
      '}',
      '.dsh_cs_card_head {',
      '  padding: 9px 12px;',
      '  display: flex;',
      '  align-items: center;',
      '  justify-content: space-between;',
      '  background: rgba(255, 255, 255, 0.02);',
      '  cursor: pointer;',
      '  user-select: none;',
      '}',
      '.dsh_cs_card_left {',
      '  display: flex;',
      '  align-items: center;',
      '  gap: 8px;',
      '  min-width: 0;',
      '  flex: auto;',
      '}',
      '.dsh_cs_card_title {',
      '  font-size: 13.5px;',
      '  font-weight: 600;',
      '  color: var(--dsw-alias-label-primary, #f1f5f9);',
      '  white-space: nowrap;',
      '  overflow: hidden;',
      '  text-overflow: ellipsis;',
      '}',
      '.dsh_cs_ws_tag {',
      '  font-size: 10.5px;',
      '  color: var(--dsw-alias-label-tertiary, #64748b);',
      '  background: rgba(255,255,255,0.06);',
      '  padding: 1px 6px;',
      '  border-radius: 4px;',
      '  flex: none;',
      '}',
      '.dsh_cs_card_right {',
      '  display: flex;',
      '  align-items: center;',
      '  gap: 8px;',
      '  flex: none;',
      '}',
      '.dsh_cs_match_count {',
      '  font-size: 11px;',
      '  color: var(--dsw-alias-button-info-fill, #3b82f6);',
      '  background: rgba(59, 130, 246, 0.12);',
      '  padding: 1px 7px;',
      '  border-radius: 10px;',
      '  font-weight: 600;',
      '}',

      '/* 匹配的消息项 */',
      '.dsh_cs_matches_list {',
      '  display: flex;',
      '  flex-direction: column;',
      '  padding: 4px 6px 6px;',
      '  gap: 4px;',
      '}',
      '.dsh_cs_match_item {',
      '  padding: 8px 10px;',
      '  border-radius: 6px;',
      '  background: transparent;',
      '  border: 0;',
      '  text-align: left;',
      '  cursor: pointer;',
      '  display: flex;',
      '  flex-direction: column;',
      '  gap: 4px;',
      '  transition: background 0.12s ease;',
      '  width: 100%;',
      '}',
      '.dsh_cs_match_item:hover {',
      '  background: var(--dsw-alias-interactive-bg-hover, rgba(255,255,255,0.06));',
      '}',
      '.dsh_cs_match_item[data-selected="true"] {',
      '  background: rgba(59, 130, 246, 0.15);',
      '  border-left: 3px solid var(--dsw-alias-button-info-fill, #3b82f6);',
      '}',
      '.dsh_cs_match_meta {',
      '  display: flex;',
      '  align-items: center;',
      '  gap: 6px;',
      '  font-size: 11px;',
      '  color: var(--dsw-alias-label-tertiary, #64748b);',
      '}',
      '.dsh_cs_role_badge {',
      '  padding: 1px 5px;',
      '  border-radius: 3px;',
      '  font-weight: 500;',
      '  font-size: 10.5px;',
      '}',
      '.dsh_cs_role_user {',
      '  background: rgba(16, 185, 129, 0.15);',
      '  color: #10b981;',
      '}',
      '.dsh_cs_role_assistant {',
      '  background: rgba(59, 130, 246, 0.15);',
      '  color: #3b82f6;',
      '}',
      '.dsh_cs_snippet {',
      '  font-size: 12.5px;',
      '  line-height: 18px;',
      '  color: var(--dsw-alias-label-secondary, #cbd5e1);',
      '  word-break: break-word;',
      '}',
      '.dsh_cs_snippet mark {',
      '  background: rgba(234, 179, 8, 0.35);',
      '  color: #fef08a;',
      '  border-radius: 2px;',
      '  padding: 0 2px;',
      '}',

      '/* 底部快捷键提示 */',
      '.dsh_cs_footer {',
      '  padding: 8px 16px;',
      '  border-top: 1px solid var(--dsw-alias-border-l1, rgba(255,255,255,0.06));',
      '  display: flex;',
      '  align-items: center;',
      '  justify-content: space-between;',
      '  font-size: 11.5px;',
      '  color: var(--dsw-alias-label-tertiary, #64748b);',
      '  background: rgba(0,0,0,0.1);',
      '}',
      '.dsh_cs_shortcuts { display: flex; gap: 12px; }',
      '.dsh_cs_key {',
      '  display: inline-block;',
      '  padding: 1px 5px;',
      '  border-radius: 4px;',
      '  background: rgba(255,255,255,0.08);',
      '  color: var(--dsw-alias-label-secondary, #94a3b8);',
      '  font-family: monospace;',
      '  font-size: 10px;',
      '  border: 1px solid rgba(255,255,255,0.1);',
      '}',

      '/* 空状态与加载中 */',
      '.dsh_cs_empty {',
      '  display: flex;',
      '  flex-direction: column;',
      '  align-items: center;',
      '  justify-content: center;',
      '  padding: 40px 20px;',
      '  color: var(--dsw-alias-label-tertiary, #64748b);',
      '  font-size: 13px;',
      '  gap: 8px;',
      '}',
      '.dsh_cs_spinner {',
      '  width: 24px;',
      '  height: 24px;',
      '  border: 2px solid rgba(255,255,255,0.1);',
      '  border-top-color: var(--dsw-alias-button-info-fill, #3b82f6);',
      '  border-radius: 50%;',
      '  animation: dsh_cs_spin 0.6s linear infinite;',
      '}',

      '/* 目标消息脉冲锁定发光动画 */',
      '@keyframes dsh_cs_flash {',
      '  0% {',
      '    box-shadow: 0 0 0 0 rgba(59, 130, 246, 0.7);',
      '    background-color: rgba(59, 130, 246, 0.28);',
      '    outline: 2px solid #3b82f6;',
      '  }',
      '  40% {',
      '    box-shadow: 0 0 0 8px rgba(59, 130, 246, 0.15);',
      '    background-color: rgba(59, 130, 246, 0.18);',
      '    outline: 2px solid #3b82f6;',
      '  }',
      '  100% {',
      '    box-shadow: 0 0 0 0 rgba(59, 130, 246, 0);',
      '    background-color: transparent;',
      '    outline: 2px solid transparent;',
      '  }',
      '}',
      '[data-chat-search-target="true"] {',
      '  animation: dsh_cs_flash 2.5s cubic-bezier(0.2, 0.9, 0.3, 1) !important;',
      '  scroll-margin: 70px;',
      '}',
      '@keyframes dsh_cs_fade { from { opacity: 0; } to { opacity: 1; } }',
      '@keyframes dsh_cs_pop { from { transform: scale(0.96) translateY(-8px); opacity: 0; } to { transform: scale(1) translateY(0); opacity: 1; } }',
      '@keyframes dsh_cs_spin { to { transform: rotate(360deg); } }'
    ].join('\n');

    var CSS_TAG = 'dsh-chat-search/styles';
    function injectCss() {
      if (typeof document === 'undefined') return;
      if (document.querySelector('style[data-plugin-css="' + CSS_TAG + '"]') !== null) return;
      var tag = document.createElement('style');
      tag.setAttribute('data-plugin', 'dsh-chat-search');
      tag.setAttribute('data-plugin-css', CSS_TAG);
      tag.textContent = CSS;
      document.head.appendChild(tag);
    }

    // ------------------------------------------------------------------
    // DOM 节点定位与高亮锁定逻辑
    // ------------------------------------------------------------------
    function nodeText(data) {
      if (typeof data === 'string') return data;
      if (!data || typeof data !== 'object') return '';
      var content = data.content;
      if (content === undefined && data.message) content = data.message.content;
      if (content === undefined) content = data.blocks;
      if (typeof content === 'string') return content;
      if (!Array.isArray(content)) return '';
      return content.filter(function (part) { return part && (part.type === 'text' || part.kind === 'text') && typeof part.text === 'string'; })
        .map(function (part) { return part.text; }).join('\n');
    }

    function selectedSessionId(snapshot) {
      if (!snapshot) return undefined;
      if (typeof snapshot.current === 'string') return snapshot.current;
      var rows = snapshot.byId || {};
      var ids = Object.keys(rows);
      for (var i = 0; i < ids.length; i++) {
        if (rows[ids[i]] && rows[ids[i]].retainedBy && rows[ids[i]].retainedBy.mainView > 0) return ids[i];
      }
      return undefined;
    }

    function readSelectedSession(uiWorkspace, sessions) {
      if (uiWorkspace && uiWorkspace.selection && typeof uiWorkspace.selection.getSnapshot === 'function') {
        return uiWorkspace.selection.getSnapshot().sessionId;
      }
      if (sessions && sessions.list && typeof sessions.list.getSnapshot === 'function') {
        return selectedSessionId(sessions.list.getSnapshot());
      }
      if (sessions && typeof sessions.getSnapshot === 'function') return selectedSessionId(sessions.getSnapshot());
      return sessions && sessions.current;
    }

    function conversationRoot(sessionId) {
      var roots = document.querySelectorAll('[data-conversation-content][data-conversation-session]');
      for (var i = 0; i < roots.length; i++) {
        var root = roots[i];
        if (root.getAttribute('data-conversation-session') !== sessionId || root.getAttribute('data-conversation-region') !== 'chat') continue;
        if (typeof root.getClientRects === 'function' && root.getClientRects().length === 0) continue;
        return root;
      }
      return null;
    }

    function normalizedSnippet(value) {
      return String(value || '').replace(/^\.\.\.|\.\.\.$/g, '').replace(/\s+/g, ' ').trim().toLowerCase();
    }

    // One owner per click: cancellation also settles pending waits and releases subscriptions.
    function createJumpTask(sessionId) {
      var listeners = new Set();
      var cleanups = [];
      var task = {
        sessionId: sessionId,
        cancelled: false,
        selected: false,
        deadline: Date.now() + 15000,
        cleanup: function (callback) { cleanups.push(callback); },
        cancel: function () {
          if (task.cancelled) return;
          task.cancelled = true;
          listeners.forEach(function (callback) { callback(); });
          listeners.clear();
          cleanups.splice(0).forEach(function (callback) { try { callback(); } catch (_) {} });
        },
        await: function (operation) {
          return new Promise(function (resolve, reject) {
            if (task.cancelled) { reject(new Error('Navigation cancelled')); return; }
            var settled = false;
            var timer;
            function finish(error, value) {
              if (settled) return;
              settled = true;
              clearTimeout(timer);
              listeners.delete(cancel);
              if (error) reject(error); else resolve(value);
            }
            function cancel() { finish(new Error('Navigation cancelled')); }
            listeners.add(cancel);
            timer = setTimeout(function () { finish(new Error('Navigation timed out')); }, Math.max(0, task.deadline - Date.now()));
            Promise.resolve(operation).then(function (value) { finish(null, value); }, function (error) { finish(error || new Error('Navigation failed')); });
          });
        },
        pause: function (delay) {
          return task.await(new Promise(function (resolve) {
            var timer = setTimeout(resolve, delay);
            task.cleanup(function () { clearTimeout(timer); });
          }));
        }
      };
      return task;
    }

    async function waitForJump(task, predicate) {
      while (!task.cancelled && Date.now() < task.deadline) {
        var result = predicate();
        if (result) return result;
        await task.pause(80);
      }
      throw new Error('Navigation timed out');
    }

    async function afterChatPaint(task) {
      if (typeof requestAnimationFrame !== 'function') { await task.pause(32); return; }
      for (var i = 0; i < 2; i++) {
        await task.await(new Promise(function (resolve) {
          var frame = requestAnimationFrame(resolve);
          task.cleanup(function () { if (typeof cancelAnimationFrame === 'function') cancelAnimationFrame(frame); });
        }));
      }
    }

    function flashMessage(target) {
      target.removeAttribute('data-chat-search-target');
      void target.offsetWidth;
      target.setAttribute('data-chat-search-target', 'true');
      setTimeout(function () { target.removeAttribute('data-chat-search-target'); }, 2800);
    }

    function messageIsVisible(target, root) {
      if (typeof target.getBoundingClientRect !== 'function') return true;
      var rect = target.getBoundingClientRect();
      var scroller = root.querySelector('[data-conversation-scroll]') || root;
      var bounds = scroller.getBoundingClientRect();
      var top = Math.max(0, bounds.top);
      var bottom = Math.min(typeof window.innerHeight === 'number' ? window.innerHeight : bounds.bottom, bounds.bottom);
      return rect.height > 0 && rect.bottom > top && rect.top < bottom;
    }

    function messageKindMatchesRole(kind, role) {
      if (!role) return true;
      if (role === 'assistant') return kind === 'assistant-step' || kind === 'assistant';
      // These are all renderings of user/message events, not separate search roles.
      if (role === 'user') return ['user', 'steering', 'context', 'turn-trigger'].indexOf(kind) !== -1;
      return kind === role;
    }

    function revealMessage(target, root) {
      var hidden = [];
      for (var element = target; element && element !== root; element = element.parentElement) {
        if (element.getAttribute('hidden') === 'until-found' && typeof element.dispatchEvent === 'function') hidden.push(element);
      }
      // The host owns fold state. Notify each nested fold just as browser Find does;
      // removing hidden/style directly would leave React's disclosure state closed.
      hidden.reverse().forEach(function (element) { element.dispatchEvent(new Event('beforematch')); });
      return hidden.length > 0;
    }

    function findMessageNode(nodeKey, turn, role, queryText, root) {
      if (typeof document === 'undefined') return null;
      root = root || document;
      var rows = root.querySelectorAll('[data-chat-anchor-key], [data-chat-node-key]');
      var wanted = normalizedSnippet(queryText);
      var best = null;
      var bestScore = -1;
      for (var i = 0; i < rows.length; i++) {
        var row = rows[i];
        if (row.isConnected === false) continue;
        if (nodeKey && (row.getAttribute('data-chat-anchor-key') === String(nodeKey) || row.getAttribute('data-chat-node-key') === String(nodeKey))) {
          var nodeKind = row.getAttribute('data-chat-flow-kind');
          if (!messageKindMatchesRole(nodeKind, role) && !(role && row.classList.contains(role))) continue;
          // Reasoning and response seats can share a node key. An exact anchor
          // wins; otherwise prefer the response/text seat, not hidden reasoning.
          var score = row.getAttribute('data-chat-anchor-key') === String(nodeKey) ? 100 : 0;
          if (role === 'assistant' && row.getAttribute('data-chat-group-part') === 'response') score += 20;
          if (wanted && normalizedSnippet(row.textContent).indexOf(wanted) !== -1) score += 10;
          if (score > bestScore) { best = row; bestScore = score; }
        }
      }
      if (best) return best;
      // Turn numbers repeat across sessions and assistant steps. A bare turn is never a match.
      if (turn !== undefined && turn !== null && wanted) {
        var turnRows = root.querySelectorAll('[data-chat-turn]');
        for (var j = 0; j < turnRows.length; j++) {
          var candidate = turnRows[j];
          if (candidate.isConnected === false || candidate.getAttribute('data-chat-turn') !== String(turn)) continue;
          var kind = candidate.getAttribute('data-chat-flow-kind') || '';
          var sameRole = !role || (role === 'assistant' ? messageKindMatchesRole(kind, role) : kind === role) || candidate.classList.contains(role);
          if (sameRole && normalizedSnippet(candidate.textContent).indexOf(wanted) !== -1) return candidate;
        }
      }
      return null;
    }

    function resolveMessageKey(chatTarget, hit) {
      var snapshot = chatTarget && chatTarget.getSnapshot();
      if (!snapshot || !snapshot.nodes || typeof snapshot.nodes.get !== 'function') return hit.nodeKey;
      var fallback;
      var order = snapshot.order || [];
      for (var i = 0; i < order.length; i++) {
        var node = snapshot.nodes.get(order[i]);
        if (!node) continue;
        var sameRole = messageKindMatchesRole(node.kind, hit.role);
        if (!sameRole) continue;
        var data = node.data || {};
        var finalNode = data.finalNode || {};
        if ((hit.nodeKey && (String(node.key) === String(hit.nodeKey) || String(node.id) === String(hit.nodeKey) || String(finalNode.messageId) === String(hit.nodeKey))) ||
            (hit.eventSeq !== undefined && (data.seq === hit.eventSeq || finalNode.seq === hit.eventSeq))) return node.key;
        var location = node.location || {};
        var nodeTurn = location.turn && location.turn.turn !== undefined ? location.turn.turn : data.turn;
        var wanted = normalizedSnippet(hit.snippet);
        if ((!hit.role || (hit.role === 'assistant' ? messageKindMatchesRole(node.kind, hit.role) : node.kind === hit.role)) &&
            String(nodeTurn) === String(hit.turn) && wanted && normalizedSnippet(nodeText(data)).indexOf(wanted) !== -1) fallback = node.key;
      }
      return fallback || hit.nodeKey;
    }

    // Wait for the actual destination occurrence and for history/React commits, not a fixed delay.
    async function locateMessage(task, hit, services) {
      var sessionId = task.sessionId;
      function checkSelection() {
        if (task.cancelled) throw new Error('Navigation cancelled');
        var selected = readSelectedSession(services.uiWorkspace, services.sessions);
        if (selected === sessionId) task.selected = true;
        else if (task.selected && selected !== undefined) {
          task.cancel();
          throw new Error('Navigation cancelled');
        }
        return selected;
      }
      await waitForJump(task, function () {
        checkSelection();
        return conversationRoot(sessionId);
      });
      var binding;
      if (services.sessions && typeof services.sessions.retain === 'function') {
        var reference = services.sessions.retain(sessionId, { source: 'dsh-chat-search' });
        task.cleanup(function () { reference.release(); });
        binding = await task.await(reference.ready);
      } else {
        binding = services.sessions && typeof services.sessions.binding === 'function' ? services.sessions.binding(sessionId) : null;
        if (binding && binding.session && typeof binding.session.open === 'function') await task.await(binding.session.open());
      }
      var session = binding && binding.session;
      function historyReady() {
        checkSelection();
        if (binding && services.sessions && typeof services.sessions.binding === 'function' && services.sessions.binding(sessionId) !== binding) {
          task.cancel();
          throw new Error('Session generation changed');
        }
        var state = session && typeof session.getSnapshot === 'function' ? session.getSnapshot() : null;
        if (state && state.openState === 'error') throw new Error('History unavailable');
        return !state || ((!state.openState || state.openState === 'open') && !state.loadingOlder);
      }
      await waitForJump(task, historyReady);
      // loadThrough joins the host history request; never let its late completion revive a cancelled jump.
      if (session && hit.eventSeq !== undefined && hit.eventSeq !== null && typeof session.loadThrough === 'function') {
        var previousHead;
        for (var page = 0; page < 3; page++) {
          await waitForJump(task, historyReady);
          await task.await(session.loadThrough(hit.eventSeq));
          await waitForJump(task, historyReady);
          var windowState = binding.eventSource && binding.eventSource.getSnapshot();
          var entries = windowState && windowState.entries;
          var head = entries && entries[0] && entries[0].event && entries[0].event.seq;
          var state = session.getSnapshot && session.getSnapshot();
          if (head === undefined || head <= hit.eventSeq || state && state.hasMore === false || head === previousHead) break;
          previousHead = head;
        }
      }
      await waitForJump(task, historyReady);
      var conversation = binding && services.uiConversation && typeof services.uiConversation.binding === 'function' ? services.uiConversation.binding(binding) : null;
      var chatTarget = conversation && typeof conversation.target === 'function' ? conversation.target('chat') : null;
      if (chatTarget && typeof chatTarget.subscribe === 'function') {
        var unsubscribe = chatTarget.subscribe(function () {});
        if (typeof unsubscribe === 'function') task.cleanup(unsubscribe);
      }
      await afterChatPaint(task);
      var stableSince = null;
      var lastTarget = null;
      var landed = null;
      while (!task.cancelled && Date.now() < task.deadline) {
        checkSelection();
        var root = conversationRoot(sessionId);
        var key = resolveMessageKey(chatTarget, hit);
        var target = root && historyReady() && findMessageNode(key, hit.turn, hit.role, hit.snippet, root);
        if (target && revealMessage(target, root)) {
          lastTarget = null;
          stableSince = null;
          await afterChatPaint(task);
          await task.pause(80);
          continue; // Re-query: expanding a group can replace its seats.
        }
        if (target) {
          var sameTarget = lastTarget === target;
          if (!sameTarget || !messageIsVisible(target, root)) {
            // Instant landing lets the host observe a real external scroll and relinquish tail following.
            target.scrollIntoView({ behavior: 'instant', block: 'center' });
            stableSince = null;
          }
          lastTarget = target;
          if (messageIsVisible(target, root)) {
            if (stableSince === null) stableSince = Date.now();
            // Host reader sampling takes 500ms; late restore/resize must not undo the first landing.
            var follow = typeof root.querySelector === 'function' ? root.querySelector('[data-chat-following-tail]') : null;
            var scroller = typeof root.querySelector === 'function' ? root.querySelector('[data-conversation-scroll]') : null;
            var atBottom = scroller && scroller.scrollHeight - scroller.clientHeight - scroller.scrollTop <= 80;
            if (Date.now() - stableSince >= 650 && (!follow || atBottom)) { landed = target; break; }
          } else stableSince = null;
        } else {
          lastTarget = null;
          stableSince = null;
        }
        await task.pause(80);
      }
      if (!landed || task.cancelled) throw new Error('Message location timed out');
      flashMessage(landed);
    }

    function findSessionRow(sessionId) {
      if (typeof document === 'undefined' || !sessionId) return null;
      var rows = document.querySelectorAll('[data-row-key], [data-session-id], [data-session]');
      for (var i = 0; i < rows.length; i++) {
        var row = rows[i];
        if (row.getAttribute('data-row-key') === 'session:' + String(sessionId) ||
            row.getAttribute('data-session-id') === String(sessionId) ||
            row.getAttribute('data-session') === String(sessionId)) return row;
      }
      return null;
    }

    function openSessionViaApi(uiWorkspace, sessions, sessionId) {
      if (uiWorkspace && typeof uiWorkspace.openSession === 'function') {
        try {
          return Promise.resolve(uiWorkspace.openSession(sessionId)).then(function () { return true; }, function () { return false; });
        } catch (e) {}
      }
      if (!sessions || !sessionId) return Promise.resolve(false);
      var names = ['select', 'open', 'navigate', 'setCurrent', 'switchTo'];
      for (var i = 0; i < names.length; i++) {
        var fn = sessions[names[i]];
        if (typeof fn === 'function') {
          try {
            return Promise.resolve(fn.call(sessions, sessionId)).then(function () { return true; }, function () { return false; });
          } catch (e2) {
            return Promise.resolve(false);
          }
        }
      }
      return Promise.resolve(false);
    }

    // 文本片段高亮渲染辅助
    function renderHighlightedText(snippet, query) {
      if (!query || !query.trim() || !snippet) return snippet;
      var q = query.trim().toLowerCase();
      var parts = [];
      var lower = snippet.toLowerCase();
      var lastIdx = 0;
      var idx = lower.indexOf(q);

      var counter = 0;
      while (idx !== -1 && counter < 20) {
        if (idx > lastIdx) {
          parts.push(snippet.slice(lastIdx, idx));
        }
        parts.push(createElement('mark', { key: 'm_' + counter }, snippet.slice(idx, idx + q.length)));
        lastIdx = idx + q.length;
        idx = lower.indexOf(q, lastIdx);
        counter++;
      }
      if (lastIdx < snippet.length) {
        parts.push(snippet.slice(lastIdx));
      }
      return parts;
    }

    // 格式化时间戳
    function formatTime(ts) {
      if (!ts) return '';
      var d = new Date(ts);
      var now = new Date();
      var diffSec = Math.floor((now.getTime() - d.getTime()) / 1000);
      if (diffSec < 60) return '刚刚';
      if (diffSec < 3600) return Math.floor(diffSec / 60) + ' 分钟前';
      if (diffSec < 86400) return Math.floor(diffSec / 3600) + ' 小时前';
      return (d.getMonth() + 1) + '月' + d.getDate() + '日';
    }

    // ------------------------------------------------------------------
    // 主搜索界面组件
    // ------------------------------------------------------------------
    function ChatSearchOverlay(props) {
      var sessions = props.sessions;
      var uiWorkspace = props.uiWorkspace;
      var uiConversation = props.uiConversation;
      var useSessions = props.useSessions;

      var currentSessionId = useSessions ? useSessions(selectedSessionId) : readSelectedSession(uiWorkspace, sessions);
      var [open, setOpen] = React.useState(false);
      var [mode, setMode] = React.useState('global'); // 'global' | 'current'
      var [query, setQuery] = React.useState('');
      var [loading, setLoading] = React.useState(false);
      var [globalResults, setGlobalResults] = React.useState({ totalMatches: 0, sessions: [] });
      var [currentMatches, setCurrentMatches] = React.useState([]);
      var [currentMatchIdx, setCurrentMatchIdx] = React.useState(-1);
      var [chatRevision, setChatRevision] = React.useState(0);
      var [expandedSessions, setExpandedSessions] = React.useState(new Set());
      var [jumpStatus, setJumpStatus] = React.useState('');
      var inputRef = React.useRef(null);
      var jumpRef = React.useRef(null);

      React.useEffect(function () {
        return function () { if (jumpRef.current) jumpRef.current.cancel(); };
      }, []);

      React.useEffect(function () {
        if (!jumpStatus) return;
        var timer = setTimeout(function () { setJumpStatus(''); }, 6000);
        return function () { clearTimeout(timer); };
      }, [jumpStatus]);

      // 全局快捷键监听：Ctrl+Shift+F 打开全局搜索，Ctrl+F 打开当前对话搜索
      React.useEffect(function () {
        function handleKeyDown(e) {
          var isMac = typeof navigator !== 'undefined' && /Mac|iPod|iPhone|iPad/.test(navigator.platform);
          var meta = isMac ? e.metaKey : e.ctrlKey;

          if (meta && e.shiftKey && (e.key === 'F' || e.key === 'f')) {
            e.preventDefault();
            setMode('global');
            setOpen(true);
          } else if (meta && (e.key === 'F' || e.key === 'f') && !e.shiftKey) {
            // 如果已经在搜索面板中，不重复触发
            if (open) return;
            // 允许快捷键呼出当前对话搜索
            var activeEl = document.activeElement;
            var isInput = activeEl && (activeEl.tagName === 'INPUT' || activeEl.tagName === 'TEXTAREA' || activeEl.isContentEditable);
            if (!isInput) {
              e.preventDefault();
              setMode('current');
              setOpen(true);
            }
          } else if (e.key === 'Escape' && open) {
            e.preventDefault();
            setOpen(false);
          }
        }
        window.addEventListener('keydown', handleKeyDown);
        return function () { window.removeEventListener('keydown', handleKeyDown); };
      }, [open]);

      // 打开时自动聚焦输入框
      React.useEffect(function () {
        if (open) {
          setTimeout(function () {
            if (inputRef.current) inputRef.current.focus();
          }, 60);
        }
      }, [open]);

      // 订阅 Chat target，保证流式追加消息时固定查询词也会重新计算。
      React.useEffect(function () {
        if (!currentSessionId || !sessions || !uiConversation || typeof uiConversation.binding !== 'function') return;
        var binding = sessions.binding(currentSessionId);
        var conversation = binding && uiConversation.binding(binding);
        var target = conversation && typeof conversation.target === 'function' ? conversation.target('chat') : null;
        if (!target || typeof target.subscribe !== 'function') return;
        var unsubscribe = target.subscribe(function () { setChatRevision(function (value) { return value + 1; }); });
        return typeof unsubscribe === 'function' ? unsubscribe : undefined;
      }, [currentSessionId, sessions, uiConversation]);

      // 实时计算当前会话匹配项
      React.useEffect(function () {
        if (!currentSessionId || !query || !query.trim() || !sessions) {
          setCurrentMatches([]);
          setCurrentMatchIdx(-1);
          return;
        }

        var q = query.trim().toLowerCase();
        var matches = [];
        var sessionBinding = sessions && typeof sessions.binding === 'function' ? sessions.binding(currentSessionId) : null;
        var chatBinding = uiConversation && sessionBinding && typeof uiConversation.binding === 'function' ? uiConversation.binding(sessionBinding) : null;
        var chatTarget = chatBinding && typeof chatBinding.target === 'function' ? chatBinding.target('chat') : null;
        var snap = chatTarget && typeof chatTarget.getSnapshot === 'function' ? chatTarget.getSnapshot() : null;
        // 旧版运行时的兼容回退：部分版本把 chat 挂在 sessions binding 上。
        if (!snap) {
          var binding = sessions && typeof sessions.binding === 'function' ? sessions.binding(currentSessionId) : null;
          var legacySnap = binding && binding.session && typeof binding.session.getSnapshot === 'function' ? binding.session.getSnapshot() : null;
          snap = legacySnap && legacySnap.chat ? legacySnap.chat : null;
        }
        if (snap && snap.order && snap.nodes) {
          var order = snap.order;
          var nodes = snap.nodes;
            var turn = 0;

            for (var i = 0; i < order.length; i++) {
              var node = nodes.get(order[i]);
              if (!node || !node.data) continue;
              if (node.kind === 'user') turn++;

              var text = '';
              if (typeof node.data === 'string') {
                text = node.data;
              } else if (node.kind === 'user' && Array.isArray(node.data.content)) {
                text = node.data.content.filter(function (block) { return block && block.type === 'text'; }).map(function (block) { return block.text; }).join('\n');
              } else if (node.kind === 'assistant-step' && Array.isArray(node.data.blocks)) {
                text = node.data.blocks.filter(function (block) { return block && block.kind === 'text'; }).map(function (block) { return block.text; }).join('\n');
              } else if (node.data.content) {
                if (Array.isArray(node.data.content)) {
                  text = node.data.content.filter(function (c) { return c && c.type === 'text'; }).map(function (c) { return c.text; }).join('\n');
                } else if (typeof node.data.content === 'string') {
                  text = node.data.content;
                }
              } else if (node.data.blocks && Array.isArray(node.data.blocks)) {
                text = node.data.blocks.filter(function (block) { return block && block.kind === 'text'; }).map(function (block) { return block.text; }).join('\n');
              } else if (node.data.message && node.data.message.content) {
                if (Array.isArray(node.data.message.content)) {
                  text = node.data.message.content.filter(function (c) { return c && c.type === 'text'; }).map(function (c) { return c.text; }).join('\n');
                } else if (typeof node.data.message.content === 'string') {
                  text = node.data.message.content;
                }
              }

              if (text) {
                var idx = text.toLowerCase().indexOf(q);
                if (idx !== -1) {
                  var start = Math.max(0, idx - 35);
                  var end = Math.min(text.length, idx + query.length + 55);
                  var snippet = (start > 0 ? '...' : '') + text.slice(start, end) + (end < text.length ? '...' : '');
                  matches.push({
                    nodeKey: node.key,
                    turn: turn,
                    role: node.kind === 'user' ? 'user' : 'assistant',
                    snippet: snippet
                  });
                }
              }
            }
          }

        setCurrentMatches(matches);
        setCurrentMatchIdx(matches.length > 0 ? 0 : -1);
      }, [currentSessionId, query, sessions, uiConversation, chatRevision]);

      // 防抖全局搜索请求
      React.useEffect(function () {
        if (mode !== 'global' || !query || !query.trim()) {
          setGlobalResults({ totalMatches: 0, sessions: [] });
          setLoading(false);
          return;
        }

        setLoading(true);
        var timer = setTimeout(function () {
          fetch('/api/chat-search?q=' + encodeURIComponent(query.trim()))
            .then(function (res) {
              if (!res.ok) throw new Error('API status ' + res.status);
              return res.json();
            })
            .then(function (data) {
              if (data && data.ok) {
                setGlobalResults(data);
                // 默认展开前 3 个会话
                var initExpanded = new Set();
                var list = data.sessions || [];
                for (var i = 0; i < Math.min(list.length, 3); i++) {
                  initExpanded.add(list[i].sessionId);
                }
                setExpandedSessions(initExpanded);
              }
              setLoading(false);
            })
            .catch(function (err) {
              // 备用降级方案：使用客户端内置 sessions.search
              if (sessions && typeof sessions.search === 'function') {
                sessions.search(query.trim()).then(function (res) {
                  if (res && res.ok && res.value && res.value.items) {
                    var items = res.value.items.map(function (it) {
                      return {
                        sessionId: it.id,
                        title: it.title || it.id,
                        workspace: it.cwd || '',
                        updatedAt: it.updatedAt,
                        matchCount: 1,
                        matches: [{
                          role: 'user',
                          turn: 1,
                          snippet: it.title || '匹配到会话',
                          nodeKey: it.nodeKey || ''
                        }]
                      };
                    });
                    setGlobalResults({ totalMatches: items.length, sessions: items });
                  }
                  setLoading(false);
                }).catch(function () { setLoading(false); });
              } else {
                setLoading(false);
              }
            });
        }, 280);

        return function () { clearTimeout(timer); };
      }, [mode, query, sessions]);

      // 会话选择只是同步发起导航；一次点击持有请求，直到历史与目标 DOM 真正就绪。
      var handleJump = function (sessionId, nodeKey, turn, role, snippet, eventSeq) {
        if (jumpRef.current) jumpRef.current.cancel();
        sessionId = sessionId || currentSessionId;
        if (!sessionId) return;
        var task = createJumpTask(sessionId);
        jumpRef.current = task;
        task.selected = readSelectedSession(uiWorkspace, sessions) === sessionId;
        setOpen(false);
        setJumpStatus('正在打开历史消息…');
        var selection = uiWorkspace && uiWorkspace.selection || sessions && (sessions.list || sessions);
        if (selection && typeof selection.subscribe === 'function') {
          var stopSelection = selection.subscribe(function () {
            var selected = readSelectedSession(uiWorkspace, sessions);
            if (selected === sessionId) task.selected = true;
            else if (task.selected && selected !== undefined) task.cancel();
          });
          if (typeof stopSelection === 'function') task.cleanup(stopSelection);
        }
        (async function () {
          try {
            if (!task.selected) {
              var opened = await task.await(openSessionViaApi(uiWorkspace, sessions, sessionId));
              if (!opened) {
                var row = findSessionRow(sessionId);
                if (!row) {
                  var collapsed = document.querySelectorAll('[data-row-key^="workspace:"][aria-expanded="false"], [data-row-key^="overflow:"][aria-expanded="false"]');
                  for (var i = 0; i < collapsed.length; i++) collapsed[i].click();
                  row = await waitForJump(task, function () { return findSessionRow(sessionId); });
                }
                if (!task.cancelled) row.click();
              }
            }
            await locateMessage(task, { nodeKey: nodeKey, turn: turn, role: role, snippet: snippet, eventSeq: eventSeq }, {
              sessions: sessions, uiWorkspace: uiWorkspace, uiConversation: uiConversation
            });
            if (jumpRef.current === task && !task.cancelled) setJumpStatus('');
          } catch (_) {
            if (jumpRef.current === task && !task.cancelled) setJumpStatus('历史消息定位未完成，请重试或检查会话加载状态。');
          } finally {
            task.cancel();
            if (jumpRef.current === task) jumpRef.current = null;
          }
        })();
      };

      // 会话内上下处导航
      var handleNavPrev = function () {
        if (currentMatches.length === 0) return;
        var nextIdx = (currentMatchIdx - 1 + currentMatches.length) % currentMatches.length;
        setCurrentMatchIdx(nextIdx);
        var target = currentMatches[nextIdx];
        handleJump(currentSessionId, target.nodeKey, target.turn, target.role, target.snippet);
      };

      var handleNavNext = function () {
        if (currentMatches.length === 0) return;
        var nextIdx = (currentMatchIdx + 1) % currentMatches.length;
        setCurrentMatchIdx(nextIdx);
        var target = currentMatches[nextIdx];
        handleJump(currentSessionId, target.nodeKey, target.turn, target.role, target.snippet);
      };

      // 切换卡片展开折叠
      var toggleSessionExpand = function (sessionId) {
        setExpandedSessions(function (prev) {
          var next = new Set(prev);
          if (next.has(sessionId)) next.delete(sessionId);
          else next.add(sessionId);
          return next;
        });
      };

      // 键盘导航处理
      var handleInputKeyDown = function (e) {
        if (e.key === 'Enter') {
          if (mode === 'current' && currentMatches.length > 0) {
            e.preventDefault();
            if (e.shiftKey) handleNavPrev();
            else handleNavNext();
          }
        }
      };

      // 悬浮启动球
      var launcherBtn = createElement('button', {
        type: 'button',
        className: 'dsh_cs_launcher',
        title: '对话搜索 (Ctrl+Shift+F)',
        onClick: function () { setOpen(true); }
      }, createElement('svg', {
        viewBox: '0 0 24 24',
        fill: 'none',
        stroke: 'currentColor',
        strokeWidth: 2,
        strokeLinecap: 'round',
        strokeLinejoin: 'round'
      },
        createElement('circle', { cx: 11, cy: 11, r: 8 }),
        createElement('line', { x1: 21, y1: 21, x2: 16.65, y2: 16.65 })
      ));

      var jumpNotice = jumpStatus ? createElement('div', {
        className: 'dsh_cs_jump_status', role: 'status', 'aria-live': 'polite'
      }, jumpStatus) : null;
      if (!open) {
        return createElement(React.Fragment, null, launcherBtn, jumpNotice);
      }

      // 构建主体列表内容
      var bodyContent = null;
      if (mode === 'global') {
        if (loading) {
          bodyContent = createElement('div', { className: 'dsh_cs_empty' },
            createElement('div', { className: 'dsh_cs_spinner' }),
            createElement('div', null, '正在全量扫描会话...')
          );
        } else if (!query || !query.trim()) {
          bodyContent = createElement('div', { className: 'dsh_cs_empty' },
            createElement('div', null, '🔍 输入关键词，搜索全部任务中的对话内容与上下文')
          );
        } else if (globalResults.sessions.length === 0) {
          bodyContent = createElement('div', { className: 'dsh_cs_empty' },
            createElement('div', null, '未在任何任务中找到包含 "' + query + '" 的对话记录')
          );
        } else {
          var cardNodes = [];
          for (var i = 0; i < globalResults.sessions.length; i++) {
            var s = globalResults.sessions[i];
            var isExpanded = expandedSessions.has(s.sessionId);

            var matchesEls = [];
            if (isExpanded) {
              for (var j = 0; j < s.matches.length; j++) {
                var m = s.matches[j];
                matchesEls.push(createElement('button', {
                  key: 'm_' + j,
                  type: 'button',
                  className: 'dsh_cs_match_item',
                  onClick: (function (sId, nKey, t, role, snippet, eventSeq) {
                    return function () { handleJump(sId, nKey, t, role, snippet, eventSeq); };
                  })(s.sessionId, m.nodeKey, m.turn, m.role, m.snippet, m.eventSeq)
                },
                  createElement('div', { className: 'dsh_cs_match_meta' },
                    createElement('span', {
                      className: 'dsh_cs_role_badge ' + (m.role === 'user' ? 'dsh_cs_role_user' : 'dsh_cs_role_assistant')
                    }, m.role === 'user' ? '用户' : '助手'),
                    createElement('span', null, '第 ' + m.turn + ' 轮'),
                    createElement('span', null, '· 点击立即定位')
                  ),
                  createElement('div', { className: 'dsh_cs_snippet' }, renderHighlightedText(m.snippet, query))
                ));
              }
            }

            cardNodes.push(createElement('div', { key: s.sessionId, className: 'dsh_cs_session_card' },
              createElement('div', {
                className: 'dsh_cs_card_head',
                onClick: (function (id) { return function () { toggleSessionExpand(id); }; })(s.sessionId)
              },
                createElement('div', { className: 'dsh_cs_card_left' },
                  createElement('span', { className: 'dsh_cs_card_title' }, s.title),
                  s.workspace ? createElement('span', { className: 'dsh_cs_ws_tag' }, s.workspace) : null
                ),
                createElement('div', { className: 'dsh_cs_card_right' },
                  createElement('span', { className: 'dsh_cs_match_count' }, s.matchCount + ' 处匹配'),
                  createElement('span', { style: { fontSize: '11px', color: 'var(--dsw-alias-label-tertiary)' } }, formatTime(s.updatedAt)),
                  createElement('span', { style: { fontSize: '10px', color: 'var(--dsw-alias-label-tertiary)' } }, isExpanded ? '▲' : '▼')
                )
              ),
              isExpanded ? createElement('div', { className: 'dsh_cs_matches_list' }, matchesEls) : null
            ));
          }
          bodyContent = cardNodes;
        }
      } else {
        // 当前会话内模式
        if (!query || !query.trim()) {
          bodyContent = createElement('div', { className: 'dsh_cs_empty' },
            createElement('div', null, '💬 输入文字，在当前对话中即时检索上下文')
          );
        } else if (currentMatches.length === 0) {
          bodyContent = createElement('div', { className: 'dsh_cs_empty' },
            createElement('div', null, '当前对话中未找到包含 "' + query + '" 的内容')
          );
        } else {
          var itemNodes = [];
          for (var k = 0; k < currentMatches.length; k++) {
            var item = currentMatches[k];
            var isSel = currentMatchIdx === k;
            itemNodes.push(createElement('button', {
              key: 'cm_' + k,
              type: 'button',
              className: 'dsh_cs_match_item',
              'data-selected': isSel ? 'true' : undefined,
              onClick: (function (idx, nodeKey, turn, role, snippet) {
                return function () {
                  setCurrentMatchIdx(idx);
                  handleJump(currentSessionId, nodeKey, turn, role, snippet);
                  setOpen(false);
                };
              })(k, item.nodeKey, item.turn, item.role, item.snippet)
            },
              createElement('div', { className: 'dsh_cs_match_meta' },
                createElement('span', {
                  className: 'dsh_cs_role_badge ' + (item.role === 'user' ? 'dsh_cs_role_user' : 'dsh_cs_role_assistant')
                }, item.role === 'user' ? '用户' : '助手'),
                createElement('span', null, '第 ' + item.turn + ' 轮'),
                isSel ? createElement('span', { style: { color: 'var(--dsw-alias-button-info-fill)' } }, '● 当前选中') : null
              ),
              createElement('div', { className: 'dsh_cs_snippet' }, renderHighlightedText(item.snippet, query))
            ));
          }
          bodyContent = itemNodes;
        }
      }

      // 模态弹窗整体渲染
      return createElement(React.Fragment, null,
        launcherBtn,
        jumpNotice,
        createElement('div', {
          className: 'dsh_cs_mask',
          onClick: function (e) {
            if (e.target === e.currentTarget) setOpen(false);
          }
        },
          createElement('div', { className: 'dsh_cs_modal' },
            // 搜索头部
            createElement('div', { className: 'dsh_cs_header' },
              createElement('div', { className: 'dsh_cs_input_row' },
                createElement('div', { className: 'dsh_cs_search_icon' },
                  createElement('svg', { viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 2 },
                    createElement('circle', { cx: 11, cy: 11, r: 8 }),
                    createElement('line', { x1: 21, y1: 21, x2: 16.65, y2: 16.65 })
                  )
                ),
                createElement('input', {
                  ref: inputRef,
                  type: 'text',
                  className: 'dsh_cs_input',
                  placeholder: mode === 'global' ? '全局搜索：输入关键词查找全部任务记录...' : '会话搜索：在当前对话中查找...',
                  value: query,
                  onChange: function (e) { setQuery(e.target.value); },
                  onKeyDown: handleInputKeyDown
                }),
                query ? createElement('button', {
                  type: 'button',
                  className: 'dsh_cs_clear_btn',
                  onClick: function () { setQuery(''); if (inputRef.current) inputRef.current.focus(); }
                }, '✕') : null
              ),
              // 模式切换 Tabs
              createElement('div', { className: 'dsh_cs_tabs' },
                createElement('button', {
                  type: 'button',
                  className: 'dsh_cs_tab',
                  'data-active': mode === 'global' ? 'true' : undefined,
                  onClick: function () { setMode('global'); }
                },
                  '🌐 全局搜索 (全部任务)',
                  globalResults.totalMatches > 0 && mode === 'global' ? createElement('span', { className: 'dsh_cs_tab_badge' }, globalResults.totalMatches) : null
                ),
                createElement('button', {
                  type: 'button',
                  className: 'dsh_cs_tab',
                  'data-active': mode === 'current' ? 'true' : undefined,
                  onClick: function () { setMode('current'); }
                },
                  '💬 当前对话内搜索',
                  currentMatches.length > 0 && mode === 'current' ? createElement('span', { className: 'dsh_cs_tab_badge' }, currentMatches.length) : null
                )
              )
            ),
            // 状态与快捷导航栏
            mode === 'current' && currentMatches.length > 0 ? createElement('div', { className: 'dsh_cs_subbar' },
              createElement('span', null, '共找到 ' + currentMatches.length + ' 处匹配 (第 ' + (currentMatchIdx + 1) + ' / ' + currentMatches.length + ' 处)'),
              createElement('div', { className: 'dsh_cs_nav_btns' },
                createElement('button', {
                  type: 'button',
                  className: 'dsh_cs_nav_btn',
                  onClick: handleNavPrev
                }, '▲ 上一处 (Shift+Enter)'),
                createElement('button', {
                  type: 'button',
                  className: 'dsh_cs_nav_btn',
                  onClick: handleNavNext
                }, '▼ 下一处 (Enter)')
              )
            ) : (mode === 'global' && globalResults.totalMatches > 0 ? createElement('div', { className: 'dsh_cs_subbar' },
              createElement('span', null, '在 ' + globalResults.sessions.length + ' 个任务会话中匹配到 ' + globalResults.totalMatches + ' 处上下文'),
              createElement('span', null, '点击会话或条目直接跳转锁定')
            ) : null),
            // 结果列表
            createElement('div', { className: 'dsh_cs_body' }, bodyContent),
            // 底部操作指引
            createElement('div', { className: 'dsh_cs_footer' },
              createElement('div', { className: 'dsh_cs_shortcuts' },
                createElement('span', null, createElement('span', { className: 'dsh_cs_key' }, 'Ctrl+Shift+F'), ' 全局搜索'),
                createElement('span', null, createElement('span', { className: 'dsh_cs_key' }, 'Ctrl+F'), ' 会话内搜'),
                createElement('span', null, createElement('span', { className: 'dsh_cs_key' }, 'Esc'), ' 关闭')
              ),
              createElement('div', null, 'DeepSeek Harness 智能上下文检索')
            )
          )
        )
      );
    }

    // ------------------------------------------------------------------
    // 插件装配与插槽挂载
    // ------------------------------------------------------------------
    function apply(ctx) {
      injectCss();

      var sessions = ctx.sessions;
      var uiWorkspace = ctx.uiWorkspace;
      var uiConversation = ctx.uiConversation;

      ctx.slots.inject('shell.overlay', function () {
        return ctx.slots.register({
          name: 'shell.overlay',
          id: 'chat-search-overlay',
          order: 95,
          inject: function () {
            return {
              sessions: sessions,
              uiWorkspace: uiWorkspace,
              uiConversation: uiConversation
            };
          }
        }, ChatSearchOverlay);
      });
    }

    exports.name = 'dsh-chat-search';
    exports.inject = ['slots', 'sessions', 'uiWorkspace', 'uiConversation', 'locale'];
    exports.apply = apply;
    return module.exports;
  }
});
