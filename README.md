# dsh-chat-search

English | [简体中文](README.zh.md)

Chat search and context highlighting plugin for DeepSeek Harness (DSH). Supports global cross-session search across all tasks and precise in-chat keyword searching.

## ✨ Features

- 🌐 **Global Cross-Session Search**:
  - Scan all task sessions and history across multiple workspaces;
  - Context extraction with keyword match snippets;
  - Group and collapse matches by session, showing roles (user/assistant), turn indices, and timestamps;
  - Click to switch sessions automatically with smooth scrolling and glow highlight animations.

- 💬 **In-Chat Search**:
  - Search within the current active session in real-time;
  - Navigate previous/next matches with keyboard shortcuts.

- 🎯 **Context Highlighting & Instant Navigation**:
  - Multi-tier DOM anchor resolution (`data-chat-anchor-key` / `data-chat-node-key` / `data-chat-turn`);
  - Smooth viewport scrolling + 2.5s pulsing outline glow (`dsh_cs_flash`) to pinpoint target messages immediately.

- ⌨️ **Keyboard Shortcuts**:
  - `Ctrl + Shift + F` / `Alt + F`: Open global search panel;
  - `Ctrl + F`: Open in-chat search;
  - `Enter` / `Shift + Enter`: Next / previous match in current chat;
  - `Esc`: Close search panel.

- 🎨 **Native Theme Integration**:
  - Built with DSH theme CSS variables, seamlessly matching dark and light modes;
  - Sleek glassmorphism floating action button (🔍) in the bottom-right corner.

## 📦 Installation

Install via DSH CLI:

```sh
dsh plugin --profile web add helo060228/dsh-chat-search
```

Or search for `dsh-chat-search` directly inside the DSH Plugin Market.

## 📄 License

[MIT License](LICENSE)
