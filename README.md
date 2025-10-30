# Bolt.DIY - Full-Stack Code Editor

A fully functional, browser-based code editor with WebContainer API integration, inspired by [bolt.diy](https://github.com/stackblitz-labs/bolt.diy). Built with Next.js 16, TypeScript, Tailwind CSS v4, and WebContainer API.

## ✨ Features

### Core Functionality
- 🎨 **Split Panel Layout** - Resizable chat and workbench panels
- 💬 **Chat Interface** - Interactive messaging with AI assistant styling
- 📝 **Live Code Editor** - Edit files with manual save button (Ctrl+S)
- 📁 **Real File Tree** - Browse actual WebContainer filesystem
- 🖥️ **Real Terminal** - Full xterm.js terminal (visible on all tabs)
- 🔄 **Live Preview** - See your Vite+React app with instant HMR
- 💾 **Manual Save** - Save button + keyboard shortcut (just like bolt.diy)
- 🔵 **Unsaved Indicator** - Blue dot shows unsaved changes
- 🌙 **Dark Theme** - Professional dark color scheme
- ✨ **Smooth Animations** - Polished transitions and interactions

### Vercel Sadnbox

## 🚀 Getting Started

```bash
# Install dependencies
pnpm install

# Run development server
pnpm run dev
```

Open [http://localhost:3000](http://localhost:3000) to see the result.

**Note**: The application requires Cross-Origin-Opener-Policy and Cross-Origin-Embedder-Policy headers to function properly (already configured in `next.config.ts`).

## 🎯 Components

### Main Layout
- **ResizablePanel** - Draggable split panel (20-80% constraints)
- **WebContainerProvider** - Context provider for WebContainer instance

### Left Panel - Chat
- Message history with user/assistant messages
- Multi-line text input with keyboard shortcuts
- Branded header with "New Chat" button

### Right Panel - Workbench
- **Code Tab**:
  - **FileTree** - Real filesystem from WebContainer (auto-refreshes)
  - **CodeEditor** - Edit files with auto-save and status indicator
- **Preview Tab**:
  - Live iframe showing running Vite application with HMR
- **Terminal** (bottom, always visible):
  - Full xterm.js terminal with jsh shell
  - Works on both Code and Preview tabs
  - Install packages, run commands, see real-time output

## 🎨 Tech Stack

- **Framework**: Next.js 16 (App Router)
- **Language**: TypeScript
- **Styling**: Tailwind CSS v4
- **Fonts**: Geist Sans & Geist Mono
- **Runtime**: WebContainer API
- **Terminal**: xterm.js + FitAddon
- **Dev Server**: Vite
- **UI Framework**: React 19

## 📁 Project Structure

```
app/
├── components/
│   ├── Chat.tsx           # Chat interface
│   ├── Workbench.tsx      # Code workbench with tabs
│   ├── FileTree.tsx       # Real file navigation
│   ├── CodeEditor.tsx     # Live code editor
│   ├── Terminal.tsx       # xterm.js terminal
│   └── ResizablePanel.tsx # Layout manager
├── context/
│   └── WebContainerContext.tsx # WebContainer state management
├── lib/
│   └── webcontainer.ts    # WebContainer utilities & Vite config
├── page.tsx               # Main page (dynamic imports)
├── layout.tsx             # Root layout
└── globals.css            # Global styles + xterm theme
```

## 🎨 Color Scheme

- Background: `#0d0d0d`, `#1a1a1a`, `#121212`
- Accent: Blue (`#3b82f6`)
- Borders: Zinc-800 (`#27272a`)
- Text: White, Zinc shades for hierarchy

## 📝 Notes

- **Fully functional** - Real code execution in the browser
- WebContainer boots automatically on page load
- Dependencies install automatically (~10-15 seconds)
- Development server starts automatically
- File changes trigger HMR automatically
- Terminal provides full shell access (`jsh`)
- Optimized for developer workflows

## ⚠️ Browser Requirements

- **Chrome/Edge**: Full support (recommended)
- **Firefox**: Requires SharedArrayBuffer enabled
- **Safari**: Limited support (WebContainer restrictions)

## 🎓 How It Works

1. **Boot**: WebContainer API initializes in the browser (~2-3 seconds)
2. **Mount**: Vite+React starter files are mounted to virtual FS
3. **Install**: NPM dependencies install automatically (~10-12 seconds)
4. **Start**: Vite dev server starts and exposes preview URL
5. **Edit**: Make changes and click Save (or press Ctrl+S)
6. **HMR**: Vite detects changes and hot-reloads the app instantly
7. **Terminal**: Run any commands, install packages, all changes reflected
8. **Switch Tabs**: Preview stays loaded when switching between Code/Preview

## 🎯 Key Features Like bolt.diy

✅ **Manual Save** - Save button + Ctrl+S keyboard shortcut  
✅ **Unsaved Indicator** - Blue dot shows when file has changes  
✅ **Terminal Always Visible** - Access terminal from any tab  
✅ **Preview Persistence** - Preview stays loaded when switching tabs  
✅ **File Tree Auto-Refresh** - Picks up terminal changes automatically  
✅ **Hot Reload** - Instant preview updates on file save  
✅ **Optimized Loading** - Clear feedback during boot/install  

## 🙏 Credits

Inspired by [bolt.diy](https://github.com/stackblitz-labs/bolt.diy) by StackBlitz Labs

## 📄 License

MIT

---

Built with Next.js and Tailwind CSS 🚀
