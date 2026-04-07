# ![Squawk](banner.png)

> A modern, cross-platform XMPP client with personality.

Squawk is a cartoon-styled XMPP (Jabber) chat client built for the modern web and beyond. Connect to any XMPP server — Goonfleet, Prosody, ejabberd, whatever speaks the protocol.

---

## Architecture

```mermaid
%%{init: {'theme': 'base', 'themeVariables': { 'primaryColor': '#a8d8ea', 'secondaryColor': '#ffcfdf', 'tertiaryColor': '#fefdca', 'primaryTextColor': '#2d3436', 'lineColor': '#b8b5ff', 'primaryBorderColor': '#b8b5ff'}}}%%
flowchart LR
    subgraph Client["🖥️ Squawk Client (React PWA)"]
        UI["UI Layer\n(React + Zustand)"]
        WS["WebSocket\nTransport"]
    end

    subgraph Relay["⚡ Squawk Relay (Node.js)"]
        API["Express API\n(REST + WS)"]
        XMPP["stanza.js\nXMPP Engine"]
    end

    subgraph Remote["🌐 XMPP Server"]
        Jabber["Any XMPP Server\n(Prosody, ejabberd, etc.)"]
    end

    UI <-->|State & Events| WS
    WS <-->|WebSocket| API
    API <-->|Commands & Events| XMPP
    XMPP <-->|XMPP Protocol| Jabber

    style Client fill:#a8d8ea,stroke:#b8b5ff,stroke-width:2px
    style Relay fill:#ffcfdf,stroke:#b8b5ff,stroke-width:2px
    style Remote fill:#fefdca,stroke:#b8b5ff,stroke-width:2px
```

## Why a Relay Server?

The relay architecture gives us:
- **No CORS/BOSH headaches** — the relay speaks native XMPP to the server
- **Account management server-side** — encrypted credential storage, auto-reconnect
- **Push notification support** — relay stays connected even when client disconnects
- **Protocol abstraction** — client speaks simple WebSocket JSON, relay handles XMPP XML

---

## Account Model

```mermaid
%%{init: {'theme': 'base', 'themeVariables': { 'primaryColor': '#a8d8ea', 'secondaryColor': '#ffcfdf', 'tertiaryColor': '#fefdca', 'primaryTextColor': '#2d3436', 'lineColor': '#b8b5ff', 'primaryBorderColor': '#b8b5ff'}}}%%
flowchart TD
    subgraph AccountConfig["📋 Account Configuration"]
        Proto["Protocol: XMPP"]
        User["Username"]
        Domain["Domain\n(e.g. your_domain.com)"]
        Resource["Resource (optional)\n(e.g. 'squawk-web')"]
        Pass["Password\n(save optional)"]
    end

    subgraph Lifecycle["🔄 Account Lifecycle"]
        Create["Create Account"] --> Store["Persist to Storage"]
        Store --> Connect["Auto-Connect\n(if password saved)"]
        Connect --> Active["Active Session"]
        Active --> Switch["Switch Account"]
        Switch --> Connect
        Store --> Edit["Edit Account"]
        Store --> Delete["Delete Account"]
    end

    AccountConfig --> Create

    style AccountConfig fill:#fefdca,stroke:#b8b5ff,stroke-width:2px
    style Lifecycle fill:#a8d8ea,stroke:#b8b5ff,stroke-width:2px
```

### Account Behaviour

| Action | Detail |
|--------|--------|
| **First launch** | Account setup wizard — minimal fields, friendly UX |
| **Saved password** | Auto-connects on app open |
| **Multiple accounts** | Switch freely; last-used becomes default |
| **Persistence** | Accounts stored locally (IndexedDB) with optional password save |
| **Resource** | Auto-generated if not specified (e.g. `squawk-<random>`) |

---

## Connection Flow

```mermaid
%%{init: {'theme': 'base', 'themeVariables': { 'primaryColor': '#a8d8ea', 'secondaryColor': '#ffcfdf', 'tertiaryColor': '#fefdca', 'primaryTextColor': '#2d3436', 'lineColor': '#b8b5ff', 'primaryBorderColor': '#b8b5ff'}}}%%
sequenceDiagram
    participant U as 🦜 User
    participant C as Squawk Client
    participant R as Squawk Relay
    participant X as XMPP Server

    U->>C: Open app
    C->>C: Load saved accounts
    alt Has saved password
        C->>R: Connect (credentials)
        R->>X: XMPP Auth (SASL)
        X-->>R: Auth OK + Roster
        R-->>C: Connected + Contacts
        C-->>U: Chat view ready
    else No saved password
        C-->>U: Login screen
        U->>C: Enter credentials
        C->>R: Connect (credentials)
        R->>X: XMPP Auth (SASL)
        X-->>R: Auth OK + Roster
        R-->>C: Connected + Contacts
        C-->>U: Chat view ready
    end

    Note over C,R: All subsequent messages<br/>flow through WebSocket
```

---

## UI Design

### Theme

Squawk uses a **cartoon-styled UI** with pastel colours derived from a mascot illustration. The palette adapts based on the active theme.

```mermaid
%%{init: {'theme': 'base', 'themeVariables': { 'primaryColor': '#a8d8ea', 'secondaryColor': '#ffcfdf', 'tertiaryColor': '#fefdca', 'primaryTextColor': '#2d3436', 'lineColor': '#b8b5ff', 'primaryBorderColor': '#b8b5ff'}}}%%
graph TD
    subgraph Palette["🎨 Default Theme — Pastel Parrot"]
        C1["🟦 Sky Blue\n#a8d8ea"]
        C2["🟪 Soft Violet\n#b8b5ff"]
        C3["🟩 Mint Green\n#c3f0ca"]
        C4["🟨 Warm Sand\n#fefdca"]
        C5["🩷 Blush Pink\n#ffcfdf"]
    end

    subgraph Usage["Applied To"]
        C1 --- B1["Backgrounds & Cards"]
        C2 --- B2["Borders & Accents"]
        C3 --- B3["Online / Success States"]
        C4 --- B4["Warnings & Highlights"]
        C5 --- B5["Notifications & Badges"]
    end

    style Palette fill:#ffffff,stroke:#b8b5ff,stroke-width:2px
    style Usage fill:#f8f8f8,stroke:#b8b5ff,stroke-width:1px
```

### Layout (Responsive)

```mermaid
%%{init: {'theme': 'base', 'themeVariables': { 'primaryColor': '#a8d8ea', 'secondaryColor': '#ffcfdf', 'tertiaryColor': '#fefdca', 'primaryTextColor': '#2d3436', 'lineColor': '#b8b5ff', 'primaryBorderColor': '#b8b5ff'}}}%%
flowchart LR
    subgraph Desktop["🖥️ Desktop / Tablet"]
        direction LR
        Sidebar["Sidebar\n• Account switcher\n• Contact list\n• Status"] --> Main["Main Panel\n• Chat view\n• Message input\n• Media preview"]
        Main --> Detail["Detail Panel\n• Contact info\n• Shared files\n• Settings"]
    end

    subgraph Mobile["📱 Mobile"]
        direction TB
        MNav["Bottom Nav\n• Chats • Contacts • Settings"]
        MNav --> MView["Full-Screen View\n• Swipe navigation\n• Pull-to-refresh"]
    end

    style Desktop fill:#a8d8ea,stroke:#b8b5ff,stroke-width:2px
    style Mobile fill:#ffcfdf,stroke:#b8b5ff,stroke-width:2px
```

---

## Tech Stack

| Layer | Technology | Why |
|-------|-----------|-----|
| **Client Framework** | React 18 + TypeScript | Component model, massive ecosystem, PWA-ready |
| **Build Tool** | Vite 6 | Near-instant HMR, no webpack pain |
| **State** | Zustand | Tiny, fast, no boilerplate |
| **Styling** | CSS Modules + CSS Custom Properties | Theming via variables, no runtime cost |
| **Routing** | React Router 7 | Standard, works with PWA |
| **Relay Server** | Node.js + Express | Same language as client, npm ecosystem |
| **XMPP Engine** | stanza.js | Best JS XMPP library, browser + Node |
| **WebSocket** | ws (server) + native (client) | Real-time relay communication |
| **Storage** | IndexedDB (Dexie.js) | Offline-capable account & message persistence |
| **PWA** | Workbox | Offline support, installable on all platforms |
| **Native Wrapper** | Capacitor (future) | iOS/Android from same codebase, zero platform hacks |

---

## Project Structure

```
squawk/
├── client/                    # React PWA
│   ├── src/
│   │   ├── components/        # UI components
│   │   │   ├── accounts/      # Account management
│   │   │   ├── chat/          # Chat interface
│   │   │   ├── contacts/      # Contact list
│   │   │   ├── layout/        # Shell, sidebar, nav
│   │   │   └── shared/        # Buttons, inputs, cards
│   │   ├── hooks/             # Custom React hooks
│   │   ├── stores/            # Zustand state stores
│   │   ├── services/          # WebSocket & API clients
│   │   ├── theme/             # CSS variables & theme config
│   │   ├── types/             # TypeScript interfaces
│   │   ├── utils/             # Helpers
│   │   ├── App.tsx
│   │   └── main.tsx
│   ├── public/
│   │   └── mascot.svg         # Squawk mascot
│   ├── index.html
│   ├── vite.config.ts
│   ├── tsconfig.json
│   └── package.json
├── relay/                     # Node.js XMPP relay
│   ├── src/
│   │   ├── xmpp/              # stanza.js XMPP client management
│   │   ├── ws/                # WebSocket server
│   │   ├── routes/            # REST API routes
│   │   ├── types/             # Shared types
│   │   └── index.ts
│   ├── tsconfig.json
│   └── package.json
├── shared/                    # Shared types & protocols
│   ├── src/
│   │   ├── messages.ts        # WebSocket message contracts
│   │   └── account.ts         # Account interfaces
│   ├── tsconfig.json
│   └── package.json
├── .gitignore
└── README.md                  # This file — the living design doc
```

---

## Getting Started

```bash
# Install dependencies
cd squawk/client && npm install
cd ../relay && npm install
cd ../shared && npm install

# Start development (from project root)
# Terminal 1 — Relay server
cd relay && npm run dev

# Terminal 2 — Client
cd client && npm run dev
```

The client opens at `http://localhost:5173` with hot reload.
The relay listens on `ws://localhost:3001`.

---

## Roadmap

### Phase 1 — Connection & Accounts ← **We are here**
- [x] Project scaffold & architecture
- [ ] Account CRUD (create, edit, delete, switch)
- [ ] XMPP connection via relay
- [ ] Auto-connect on launch
- [ ] Connection status indicators

### Phase 2 — Chat
- [ ] 1:1 messaging
- [ ] Group chat (MUC)
- [ ] Message history (MAM)
- [ ] Typing indicators
- [ ] Read receipts

### Phase 3 — Contacts & Presence
- [ ] Roster management
- [ ] Presence status (online, away, DND)
- [ ] Contact search
- [ ] Avatar support

### Phase 4 — Rich Features
- [ ] File transfer
- [ ] Image/media preview
- [ ] Emoji picker
- [ ] Notifications (push via relay)
- [ ] End-to-end encryption (OMEMO)

### Phase 5 — Native
- [ ] Capacitor wrapping for iOS/Android
- [ ] Native notifications
- [ ] Background connection persistence

---

*Built with 🦜 and questionable taste in colour palettes.*
