# CoWork - AI-Powered Workspace

<div align="center">

![CoWork Logo](./public/icon.svg)

A feature-rich, local-first AI workspace that replicates Claude CoWork's capabilities with multiple AI provider support.

**Built with Next.js 16 • TypeScript • Tailwind CSS • Zustand**

</div>

---

## ✨ Features

### 💬 Multi-Provider AI Chat
- **Google Gemini** - Gemini 2.0 Flash, 1.5 Pro, 1.5 Flash
- **OpenAI** - GPT-4o, GPT-4 Turbo, GPT-3.5 Turbo
- **Anthropic** - Claude 3.5 Sonnet, Claude 3 Opus, Claude 3 Haiku
- Real-time streaming responses
- Markdown rendering with syntax highlighting

### 📦 Artifact System
- Side panel for code, documents, and visualizations
- Automatic code block extraction
- Copy to clipboard and download options
- Version history tracking

### 📁 Project Organization
- Create projects to organize conversations
- Filter conversations by project
- Project descriptions and metadata

### 📤 Export Conversations
- Export as JSON (full data)
- Export as Markdown (formatted document)
- Export as Plain Text

### ⚡ Code Execution
- Sandboxed Python execution
- Sandboxed JavaScript execution
- Real-time output display

### 🎨 Theme Support
- 🌙 Dark mode (default)
- ☀️ Light mode
- 🖥️ System preference

### 📱 Responsive Design
- Mobile-friendly hamburger menu
- Touch-optimized controls
- Adaptive layouts

### ⌨️ Keyboard Shortcuts
| Shortcut | Action |
|----------|--------|
| `⌘B` | Toggle sidebar |
| `⌘N` | New conversation |
| `⌘,` | Open settings |
| `⌘\` | Toggle artifact panel |
| `⌘⇧D` | Toggle theme |

---

## 🚀 Quick Start

### Prerequisites
- Node.js 18+ 
- npm or yarn
- API key for at least one provider (Gemini, OpenAI, or Anthropic)

### Installation

```bash
# Clone the repository
git clone https://github.com/yourusername/cowork-app.git
cd cowork-app

# Install dependencies
npm install

# Start development server
npm run dev
```

### Configuration

1. Open the app at `http://localhost:3000`
2. Press `⌘,` to open settings
3. Enter your API key for your preferred provider:
   - **Google Gemini**: [Get API key](https://makersuite.google.com/app/apikey)
   - **OpenAI**: [Get API key](https://platform.openai.com/api-keys)
   - **Anthropic**: [Get API key](https://console.anthropic.com/account/keys)

---

## 📁 Project Structure

```
src/
├── app/                    # Next.js App Router
│   ├── page.tsx           # Main application
│   ├── globals.css        # Global styles & theme
│   └── api/
│       ├── chat/          # AI chat endpoint
│       └── execute/       # Code execution endpoint
├── components/
│   ├── chat/              # Chat UI components
│   │   ├── Message.tsx    # Message bubble
│   │   ├── MessageInput.tsx
│   │   └── MessageList.tsx
│   ├── artifacts/         # Artifact panel
│   │   └── ArtifactPanel.tsx
│   ├── layout/            # Layout components
│   │   ├── Sidebar.tsx
│   │   ├── SettingsDialog.tsx
│   │   ├── ExportModal.tsx
│   │   ├── ProjectModal.tsx
│   │   └── FileManager.tsx
│   ├── tools/             # Tool visualization
│   │   └── ToolCallDisplay.tsx
│   └── ui/                # Base UI components
│       ├── button.tsx
│       ├── dialog.tsx
│       ├── skeleton.tsx
│       ├── toast.tsx
│       └── ...
├── hooks/
│   ├── useKeyboardShortcuts.tsx
│   └── useTheme.tsx
├── lib/
│   ├── ai/                # AI provider integrations
│   │   ├── gemini.ts
│   │   ├── openai.ts
│   │   └── anthropic.ts
│   ├── sandbox/           # Code execution sandbox
│   └── utils/             # Utility functions
├── stores/                # Zustand state management
│   └── index.ts
└── types/                 # TypeScript definitions
    └── index.ts
```

---

## 🛠️ Development

### Available Scripts

```bash
# Development server with hot reload
npm run dev

# Production build
npm run build

# Start production server
npm start

# Type checking
npx tsc --noEmit

# Linting
npm run lint
```

### Tech Stack

| Category | Technology |
|----------|------------|
| Framework | Next.js 16 (App Router) |
| Language | TypeScript |
| Styling | Tailwind CSS 4 |
| State | Zustand |
| UI Components | Radix UI + shadcn/ui |
| Markdown | react-markdown + rehype |
| Syntax Highlighting | Prism.js |
| Icons | Lucide React |

---

## 📝 API Reference

### Chat Endpoint
`POST /api/chat`

Request body:
```json
{
  "messages": [
    { "role": "user", "content": "Hello" }
  ],
  "provider": "gemini",
  "model": "gemini-2.0-flash-exp",
  "apiKey": "your-api-key"
}
```

Response: Server-Sent Events stream

### Execute Endpoint
`POST /api/execute`

Request body:
```json
{
  "code": "print('Hello')",
  "language": "python"
}
```

---

## 🔒 Security

- API keys are stored locally in browser localStorage
- No server-side API key storage
- Code execution is sandboxed (Python via Pyodide, JS via eval with timeout)
- All data stored locally - nothing sent to external servers except AI providers

---

## 📄 License

MIT License - feel free to use this project for personal or commercial use.

---

## 🙏 Acknowledgments

- Inspired by [Claude CoWork](https://claude.ai)
- UI components from [shadcn/ui](https://ui.shadcn.com)
- Icons from [Lucide](https://lucide.dev)

---

<div align="center">

**Made with ❤️ using AI assistance**

</div>
