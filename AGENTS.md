# Email Client for AWS S3 and SES - Developer & Agent Guide (`AGENTS.md`)

This document provides essential architectural context, directory structures, development workflows, and coding conventions for AI agents and human developers contributing to this repository.

---

## 1. Project Overview

**Email Client for AWS S3 and SES** is a cross-platform desktop application built with **Electron**, **React 19**, **Vite**, **TypeScript**, and **Tailwind CSS**. It connects directly to Amazon Web Services (AWS) S3 buckets to inspect, list, and view stored raw email messages (`.eml`, MIME multipart, or text files) without requiring a dedicated backend service or bucket CORS modifications.

### Core Capabilities
- **Direct S3 Integration**: Connects via AWS SDK v3 in the Electron main process (bypassing browser CORS limitations).
- **In-App Configuration**: Bucket, Region, Access Key ID, Secret Access Key, Session Token, and Prefix configured via UI and persisted to a local `config.json` file.
- **Connection Diagnostics**: Live "Test Connection" button testing S3 access and reporting detailed AWS IAM/S3 error messages.
- **Header Parsing**: Extracts core MIME headers (`From`, `Date`, `Subject`, `Message-ID`) from S3 objects.
- **Multi-Window Email Viewer**: Clicking any email row launches an independent native `BrowserWindow` displaying metadata and the full raw text content.
- **Extensible Architecture**: Structured for a future rich MIME parsing engine (`mailparser` / `postal-mime` with sanitized HTML rendering and attachment extraction).

---

## 2. Technology Stack

| Layer | Technology |
| :--- | :--- |
| **Desktop Shell** | Electron 34+ |
| **Frontend Framework** | React 19 + TypeScript |
| **Build Tool & Bundler** | Vite + `vite-plugin-electron` |
| **Styling** | Tailwind CSS v4 + Lucide React Icons |
| **AWS Integration** | `@aws-sdk/client-s3` (v3) |
| **Configuration Storage** | Local JSON (`config.json` in user app data directory) |

---

## 3. Architecture & Security Model

```
┌─────────────────────────────────────────────────────────────┐
│                    Electron Main Process                    │
│                                                             │
│  • Config Store: Local config.json reader/writer            │
│  • S3 Service: AWS SDK Client (ListObjectsV2, GetObject)    │
│  • Window Manager: Main Window & Spinoff Viewer Windows    │
│  • IPC Handlers: Type-safe event dispatchers                │
└──────────────────────────────┬──────────────────────────────┘
                               │
                      IPC (contextBridge)
                               │
┌──────────────────────────────┴──────────────────────────────┐
│                  Electron Preload Process                   │
│                                                             │
│  • Exposes `window.electronAPI` safely to Renderer         │
│  • Context Isolation: ENABLED | Node Integration: DISABLED │
└──────────────────────────────┬──────────────────────────────┘
                               │
┌──────────────────────────────┴──────────────────────────────┐
│                  React Renderer (Frontend)                  │
│                                                             │
│  • Main Window:                                             │
│      - Settings Modal (AWS credentials & bucket config)     │
│      - Search, Filter & Email Listing Table                 │
│  • Viewer Window (`#viewer?key=...`):                       │
│      - Header summary card                                  │
│      - Raw email text viewer (monospace, wrap, search)      │
│      - Tab placeholder for future MIME HTML viewer          │
└─────────────────────────────────────────────────────────────┘
```

### Critical Security Rules
1. **Never import `@aws-sdk/*` or `fs` in the Renderer process.** All network requests and disk I/O must remain in the Main process via IPC handlers.
2. **Context Isolation**: Always keep `contextIsolation: true` and `nodeIntegration: false` in all `BrowserWindow` instances.
3. **IPC Bridge Typing**: Any new IPC channel must be typed in both `src/preload/index.ts` and `src/renderer/src/types/index.ts`.

---

## 4. Directory Structure

```
s3_email_client/
├── TODO.txt                     # Active project milestones and checklist
├── AGENTS.md                    # Developer and AI agent guide (this file)
├── package.json                 # Dependencies and scripts
├── tsconfig.json                # TypeScript root configuration
├── tsconfig.node.json           # TypeScript configuration for Node/Vite
├── vite.config.ts               # Vite & electron build configuration
├── tailwind.config.js           # Tailwind CSS configuration
├── src/
│   ├── main/                    # Electron Main Process (Node.js)
│   │   ├── index.ts             # Main process entrypoint & IPC registration
│   │   ├── config.ts            # Local configuration file read/write manager
│   │   ├── s3.ts                # AWS S3 Client & header extraction streaming
│   │   └── windows.ts           # Multi-window manager (Main & Viewer windows)
│   │
│   ├── preload/                 # Electron Preload Process
│   │   └── index.ts             # ContextBridge exposing `window.electronAPI`
│   │
│   └── renderer/                # React Frontend Application
│       ├── index.html           # HTML entrypoint
│       └── src/
│           ├── main.tsx         # React DOM root mounting
│           ├── App.tsx          # Root router (Main List vs Viewer route)
│           ├── index.css        # Tailwind styles & theme variables
│           ├── types/
│           │   └── index.ts     # Shared TypeScript interfaces & IPC types
│           └── components/
│               ├── Header.tsx         # Top navigation bar & connection badge
│               ├── SettingsModal.tsx  # AWS Credentials & bucket settings
│               ├── EmailList.tsx      # S3 Email table, search & filter
│               └── EmailViewer.tsx    # Raw text viewer window component
```

---

## 5. Development Workflow & Commands

### Prerequisites
- Node.js `v20.x` or higher (installed via `/opt/homebrew/bin/node` or system PATH).
- npm `v10.x` or higher.

### Key Commands
```bash
# Install dependencies
npm install

# Start development mode (Electron + Vite Hot-Reload)
npm run dev

# Run TypeScript typecheck
npm run typecheck

# Build frontend and Electron scripts


---

## 6. IPC Channels Reference

| Channel Name | Direction | Payload | Return Value | Purpose |
| :--- | :--- | :--- | :--- | :--- |
| `config:get` | Renderer $\rightarrow$ Main | None | `AppConfig` | Read local `config.json` |
| `config:save` | Renderer $\rightarrow$ Main | `AppConfig` | `{ success: boolean }` | Persist config to disk |
| `config:getPath` | Renderer $\rightarrow$ Main | None | `string` | Get path to local `config.json` |
| `s3:testConnection` | Renderer $\rightarrow$ Main | `AppConfig` | `{ success: boolean, message?: string }` | Verify AWS credentials |
| `s3:listEmails` | Renderer $\rightarrow$ Main | `{ prefix?: string, maxKeys?: number, folder?: string }` | `ListEmailsResult` | List objects & parse headers |
| `s3:getEmailContent` | Renderer $\rightarrow$ Main | `{ key: string }` | `EmailContentResult` | Get full parsed and raw object content |
| `s3:deleteEmail` | Renderer $\rightarrow$ Main | `{ key: string, permanent?: boolean }` | `{ success: boolean, error?: string }` | Move to trash or permanently delete S3 email |
| `attachment:save` | Renderer $\rightarrow$ Main | `{ filename, contentBase64, contentType }` | `SaveAttachmentResult` | Save attachment via native dialog |
| `smtp:test` | Renderer $\rightarrow$ Main | `SmtpConfig` | `{ success: boolean, message?: string }` | Verify SMTP connection |
| `smtp:send` | Renderer $\rightarrow$ Main | `OutgoingEmailPayload` | `SendEmailResult` | Send email via SMTP (`nodemailer`) |
| `window:openViewer` | Renderer $\rightarrow$ Main | `{ key: string }` | `void` | Open standalone viewer window |

---

## 7. Configuration File Format

The configuration is stored locally at `~/.config/s3-email-client/config.json` (or the platform-specific `app.getPath('userData')/config.json`):

```json
{
  "bucket": "my-email-bucket",
  "region": "us-east-1",
  "accessKeyId": "AKIA...",
  "secretAccessKey": "...",
  "sessionToken": "",
  "prefix": "incoming/",
  "maxKeys": 100,
  "autoRefreshEnabled": true,
  "autoRefreshInterval": 60,
  "showRefreshCountdown": true,
  "smtp": {
    "host": "email-smtp.eu-west-1.amazonaws.com",
    "port": 587,
    "secure": false,
    "user": "smtp-user",
    "password": "smtp-password",
    "fromName": "Fabio Silva",
    "fromEmail": "me@fabiosilva.eu"
  }
}
```

---

## 8. Coding & Contribution Conventions for Agents

1. **State Management**: Use React hooks (`useState`, `useEffect`, `useCallback`) for local UI state. Keep IPC calls encapsulated in custom hooks or clean helper functions.
2. **Error Handling**: AWS S3 and SMTP calls must always be wrapped in `try/catch` with descriptive user-facing error messages returned to the renderer.
3. **MIME / Raw Header Safety**: Header extraction in `src/main/s3.ts` and `src/main/parser.ts` handles MIME structures, inline CIDs, attachments, and partial header fallbacks safely.
4. **Window State**: Ensure viewer windows clean up their event listeners when closed.
5. **Keep TODO.txt Updated**: When completing milestones, check off tasks in [TODO.txt](file:///Users/fabiomssilva/projects/s3_email_client/TODO.txt).

