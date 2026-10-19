/**
 * dsh-chat-search 客户端插件
 * 
 * 功能：
 * 1. 全局跨会话搜索：在所有历史任务会话中搜索关键词，展示匹配会话与上下文片段，点击一键切换并锁定。
 * 2. 当前会话内搜索：在当前正在进行的对话中实时检索，支持列表查看与上下处快速跳转。
 * 3. 上下文精准锁定：平滑滚动到目标消息，并伴随脉冲发光动效高亮，秒级锁定。
 * 4. 快捷键支持：Ctrl+Shift+F / Alt+F 唤起搜索，Esc 关闭，Enter/Shift+Enter 上下跳转。
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
    function highlightAndScrollNode(nodeKey, turn, retryCount) {
      if (typeof document === 'undefined') return;
      retryCount = retryCount || 0;

      var target = null;
      if (nodeKey) {
        target = document.querySelector('[data-chat-anchor-key="' + nodeKey + '"]');
        if (!target) target = document.querySelector('[data-chat-node-key="' + nodeKey + '"]');
      }
      if (!target && turn) {
        target = document.querySelector('[data-chat-turn="' + turn + '"]');
      }

      if (target) {
        target.scrollIntoView({ behavior: 'smooth', block: 'center' });
        target.removeAttribute('data-chat-search-target');
        void target.offsetWidth; // 触发 reflow
        target.setAttribute('data-chat-search-target', 'true');
        setTimeout(function () {
          target.removeAttribute('data-chat-search-target');
        }, 2800);
      } else if (retryCount < 12) {
        // 会话切换后等待 DOM 渲染
        setTimeout(function () {
          highlightAndScrollNode(nodeKey, turn, retryCount + 1);
        }, 120);
      }
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
      var useSessions = props.useSessions;

      var currentSessionId = useSessions ? useSessions(function (s) { return s.current; }) : undefined;
      var [open, setOpen] = React.useState(false);
      var [mode, setMode] = React.useState('global'); // 'global' | 'current'
      var [query, setQuery] = React.useState('');
      var [loading, setLoading] = React.useState(false);
      var [globalResults, setGlobalResults] = React.useState({ totalMatches: 0, sessions: [] });
      var [currentMatches, setCurrentMatches] = React.useState([]);
      var [currentMatchIdx, setCurrentMatchIdx] = React.useState(-1);
      var [expandedSessions, setExpandedSessions] = React.useState(new Set());
      var inputRef = React.useRef(null);

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

      // 实时计算当前会话匹配项
      React.useEffect(function () {
        if (!currentSessionId || !query || !query.trim() || !sessions) {
          setCurrentMatches([]);
          setCurrentMatchIdx(-1);
          return;
        }

        var q = query.trim().toLowerCase();
        var matches = [];
        var binding = sessions.binding(currentSessionId);
        if (binding) {
          var snap = binding.session.getSnapshot();
          if (snap && snap.chat && snap.chat.order && snap.chat.nodes) {
            var order = snap.chat.order;
            var nodes = snap.chat.nodes;
            var turn = 0;

            for (var i = 0; i < order.length; i++) {
              var node = nodes.get(order[i]);
              if (!node || !node.data) continue;
              if (node.kind === 'user') turn++;

              var text = '';
              if (typeof node.data === 'string') {
                text = node.data;
              } else if (node.data.content) {
                if (Array.isArray(node.data.content)) {
                  text = node.data.content.filter(function (c) { return c && c.type === 'text'; }).map(function (c) { return c.text; }).join('\n');
                } else if (typeof node.data.content === 'string') {
                  text = node.data.content;
                }
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
        }

        setCurrentMatches(matches);
        setCurrentMatchIdx(matches.length > 0 ? 0 : -1);
      }, [currentSessionId, query, sessions]);

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
                          nodeKey: ''
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

      // 切换到目标会话并滚动高亮
      var handleJump = function (sessionId, nodeKey, turn) {
        setOpen(false);
        if (sessionId && sessionId !== currentSessionId) {
          var targetRow = document.querySelector('[data-row-key="session:' + sessionId + '"]');
          if (targetRow) {
            targetRow.click();
          } else {
            // 如果所在工作区被折叠，尝试展开工作区与溢出项
            var collapsedWs = document.querySelectorAll('[data-row-key^="workspace:"][aria-expanded="false"]');
            for (var w = 0; w < collapsedWs.length; w++) {
              collapsedWs[w].click();
            }
            var overflowRows = document.querySelectorAll('[data-row-key^="overflow:"][aria-expanded="false"]');
            for (var o = 0; o < overflowRows.length; o++) {
              overflowRows[o].click();
            }
            setTimeout(function () {
              var retryRow = document.querySelector('[data-row-key="session:' + sessionId + '"]');
              if (retryRow) retryRow.click();
            }, 60);
          }
        }
        highlightAndScrollNode(nodeKey, turn, 0);
      };

      // 会话内上下处导航
      var handleNavPrev = function () {
        if (currentMatches.length === 0) return;
        var nextIdx = (currentMatchIdx - 1 + currentMatches.length) % currentMatches.length;
        setCurrentMatchIdx(nextIdx);
        var target = currentMatches[nextIdx];
        highlightAndScrollNode(target.nodeKey, target.turn, 0);
      };

      var handleNavNext = function () {
        if (currentMatches.length === 0) return;
        var nextIdx = (currentMatchIdx + 1) % currentMatches.length;
        setCurrentMatchIdx(nextIdx);
        var target = currentMatches[nextIdx];
        highlightAndScrollNode(target.nodeKey, target.turn, 0);
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

      if (!open) {
        return launcherBtn;
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
                  onClick: (function (sId, nKey, t) {
                    return function () { handleJump(sId, nKey, t); };
                  })(s.sessionId, m.nodeKey, m.turn)
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
              onClick: (function (idx, nodeKey, turn) {
                return function () {
                  setCurrentMatchIdx(idx);
                  highlightAndScrollNode(nodeKey, turn, 0);
                  setOpen(false);
                };
              })(k, item.nodeKey, item.turn)
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

      ctx.slots.inject('shell.overlay', function () {
        return ctx.slots.register({
          name: 'shell.overlay',
          id: 'chat-search-overlay',
          order: 95,
          inject: function () {
            return {
              sessions: sessions
            };
          }
        }, ChatSearchOverlay);
      });
    }

    exports.name = 'dsh-chat-search';
    exports.inject = ['slots', 'sessions', 'locale'];
    exports.apply = apply;
    return module.exports;
  }
});
