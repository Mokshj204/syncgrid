# Real-Time Google Sheets ↔ Web Synchronization (React + Node.js + Python + PostgreSQL)

[![License: MIT](https://img.shields.io/badge/License-MIT-emerald.svg)](LICENSE)
[![Frontend](https://img.shields.io/badge/Frontend-React%2018%20%2B%20TypeScript-blue)](frontend)
[![Real-time Gateway](https://img.shields.io/badge/Gateway-Node.js%20%2B%20Socket.IO-green)](backend-node)
[![Database](https://img.shields.io/badge/Database-PostgreSQL%20%2B%20JSONB-336791)](backend-node/db)
[![Sync Engine](https://img.shields.io/badge/Engine-Python%20%2B%20FastAPI-yellow)](backend-python)

A fullstack production-grade collaborative spreadsheet application providing **bi-directional real-time synchronization** between an interactive web grid and a Google Sheet.

Any cell edit, addition, or deletion made in the web interface is persisted in PostgreSQL and synchronized to Google Sheets. Any edit, formula change, or deletion made directly in Google Sheets is captured (via instant Apps Script webhooks or background polling) and broadcast to all connected web clients in real time without requiring a page reload.

---

## 1. System Architecture

```mermaid
flowchart TD
    subgraph Cloud["1. Google Cloud"]
        GS["📊 Google Sheets Cloud (Dynamic Columns A...Z, AA, BB...)"]
    end

    subgraph PythonLayer["2. Python Sync Engine (backend-python :8000)"]
        PY["🐍 Python FastAPI + gspread\n• Google Sheets API v4 Integration & Batch Writes\n• Autonomous Change Detection Poller (MD5 Hash Diff)\n• Dynamic Column Schema Detection (A..Z, AA..)\n• Optimistic Concurrency Hash Verification"]
    end

    subgraph NodeLayer["3. Node.js Gateway Service (backend-node :5000)"]
        NODE["🟢 Node.js Express + Socket.IO\n• Real-Time Client WebSocket Gateway\n• Collaborator Presence & 10-Seat Limit Enforcement\n• Webhook Ingestion (/api/webhook/sheets)\n• Data Orchestrator & PostgreSQL Persistence"]
    end

    subgraph DatabaseLayer["4. PostgreSQL Database Layer"]
        DB[("🐘 PostgreSQL Database\n• sheet_rows: Atomic JSONB cell storage\n• sheet_columns: Dynamic column registry\n• cell_formats & users: Formatting & presence")]
    end

    subgraph FrontendLayer["5. React Web Frontend (frontend :5173)"]
        REACT["⚛️ React 18 + TypeScript SPA\n• Interactive Spreadsheet Grid with Inline Editing\n• Single-Row Unified Excel Formula Bar (fx)\n• Live Collaborator Badges & Peer Typing Cursors\n• 3-Way Interactive Conflict Resolution (OCC)\n• Full Bilingual Localization (English / हिंदी)"]
    end

    %% Data Flow Connections
    GS <-->|"Sheets API v4 Batch Updates & Polling"| PY
    GS -.->|"Fast Webhook Push (Apps Script onEdit <300ms)"| NODE
    PY <-->|"Internal Sync Events & Forwarded Writes"| NODE
    NODE <-->|"Atomic SQL Queries & JSONB Cache"| DB
    NODE <-->|"Full-Duplex Socket.IO & REST API"| REACT

    style Cloud fill:#0f172a,stroke:#38bdf8,stroke-width:2px,color:#fff
    style PythonLayer fill:#0f172a,stroke:#f59e0b,stroke-width:2px,color:#fff
    style NodeLayer fill:#0f172a,stroke:#10b981,stroke-width:2px,color:#fff
    style DatabaseLayer fill:#0f172a,stroke:#6366f1,stroke-width:2px,color:#fff
    style FrontendLayer fill:#0f172a,stroke:#ec4899,stroke-width:2px,color:#fff
```

### Text Flowchart Representation

```text
                      ┌────────────────────────────┐
                      │    Google Sheets Cloud     │
                      │ (Dynamic Cols: A..Z, AA..) │
                      └──────────────┬─────────────┘
                                     │
           ┌─────────────────────────┴─────────────────────────┐
           │                                                   │
  (A) Push Webhook (<300ms)                          (B) API v4 CRUD & Polling
  Apps Script onEdit() POST                          gspread Hash Diff (3s)
           │                                                   │
           │                                                   ▼
           │                                  ┌─────────────────────────────┐
           │                                  │     PYTHON SYNC ENGINE      │
           │                                  │    (backend-python :8000)   │
           │                                  │                             │
           │                                  │ • Google Sheets API v4 CRUD │
           │                                  │ • Batch Writes into Sheets  │
           │                                  │ • Autonomous Polling Loop   │
           │                                  │ • Dynamic Column Detection  │
           │                                  └──────────────┬──────────────┘
           │                                                 │
           │                                        Internal Sync Events &
           │                                        Forwarded REST Writes
           ▼                                                 │
┌───────────────────────────────────────────┐                │
│          NODE.JS GATEWAY SERVICE          │◄───────────────┘
│           (backend-node :5000)            │
│                                           │
│ • Real-Time Socket.IO WebSocket Gateway   │
│ • Collaborator Presence & 10-Seat Limit   │
│ • Ingests Apps Script HTTP Webhooks       │
│ • PostgreSQL JSONB Cache & Orchestrator   │
└─────────────────────┬─────────────────────┘
                      │
              SQL JSONB Queries
                      ▼
┌───────────────────────────────────────────┐
│            POSTGRESQL DATABASE            │
│ • sheet_rows: High-performance JSONB cells│
│ • sheet_columns: Dynamic headers (A..AA)  │
│ • cell_formats: Styles (bold, alignment)  │
│ • users: Active collaborator identities   │
└─────────────────────┬─────────────────────┘
                      │
            WebSocket / HTTP Stream
            Sub-second Bidirectional Sync
                      │
                      ▼
┌───────────────────────────────────────────┐
│           REACT 18 WEB FRONTEND           │
│             (frontend :5173)              │
│                                           │
│ • Direct Cell Editing & Formula Bar (fx)  │
│ • Live Colleague Cursors & Typing Badges  │
│ • Low-Memory Chunk Pagination (10-100)    │
│ • 3-Way Conflict Resolution Modal (OCC)   │
│ • Bilingual Interface (English / हिंदी)   │
└───────────────────────────────────────────┘
```

### Service Division of Labor: Why Node.js + Python?

The system is deliberately designed as a **hybrid microservice architecture** to leverage the unique runtime strengths of both Node.js and Python:

| Feature / Responsibility | Node.js Gateway (`backend-node`) | Python Sync Engine (`backend-python`) |
| :--- | :--- | :--- |
| **Primary Specialty** | **Real-Time Client Gateway & Data Orchestrator** | **Google Cloud & Sheets API Specialist** |
| **Client WebSockets** | **Yes** — Native asynchronous event loop handles concurrent browser WebSocket connections (`Socket.IO`) with sub-millisecond dispatch. | **No** — Offloads client WebSocket multiplexing to prevent blocking Python workers. |
| **Google Sheets API v4** | **No** — Delegates all Google Sheets API calls to Python. | **Yes** — Direct integration using `gspread` and official Google Cloud Service Account credentials. |
| **Database Persistence** | **Yes** — Connects directly to PostgreSQL to read/write JSONB rows, custom formats, and column definitions. | **No** — Stateless engine; relies on Node.js internal webhook for persistence. |
| **Change Detection Poller** | **No** — Receives push events from Python. | **Yes** — Runs autonomous background worker calculating MD5 checksum diffs against live Google Sheets. |
| **Webhook Ingestion** | **Yes** — Exposes `/api/webhook/sheets` for Google Apps Script instant push triggers. | **No** — Node forwards webhook data or lets poller sync. |
| **Collaborator Presence** | **Yes** — Tracks active users, peer cursor positions, real-time typing indicators, and enforces the 10-seat limit. | **No** — Unaware of individual browser sessions. |
| **Column Management** | **Yes** — Persists dynamic column headers in PostgreSQL. | **Yes** — Introspects Google Sheet structure and expands columns (A...Z, AA, BB...) on demand. |

---

## 2. Environment Variables

The project uses `.env` files for configuration. A template is provided in [`.env.example`](.env.example). You can place `.env` in the root directory or configure environment variables in your deployment environment:

| Variable | Service | Default | Description |
| :--- | :--- | :--- | :--- |
| `DATABASE_URL` | Node.js | Required | PostgreSQL connection URI (e.g. `postgresql://user:pass@host:5432/dbname?sslmode=require`). |
| `NODE_PORT` | Node.js | `5000` | Port for the Node.js Express & WebSocket gateway. |
| `NODE_HOST` | Node.js | `0.0.0.0` | Host binding for Node.js. |
| `PYTHON_SERVICE_URL` | Node.js | `http://localhost:8000` | Internal URL where Node.js connects to the Python engine. |
| `WEBHOOK_SECRET` | Node.js | `sync_secret_token_123` | Security secret for authenticating Google Apps Script webhooks. |
| `CORS_ORIGIN` | Node.js | `*` | Allowed CORS origins for browser HTTP and WebSocket traffic. |
| `PYTHON_PORT` | Python | `8000` | Port for the Python FastAPI service. |
| `PYTHON_HOST` | Python | `0.0.0.0` | Host binding for Python service. |
| `POLL_INTERVAL_SECONDS`| Python | `3.0` | Frequency in seconds for Google Sheets change detection. |
| `ENABLE_POLLING` | Python | `true` | Set to `true` to enable automated background polling. |
| `NODE_INTERNAL_URL` | Python | `http://localhost:5000/internal/sync-event` | Node.js internal webhook endpoint for poller events. |
| `GOOGLE_APPLICATION_CREDENTIALS` | Python | `credentials.json` | Path to Google Service Account JSON file. |
| `GOOGLE_SERVICE_ACCOUNT_JSON` | Python | Optional | Raw JSON string of Service Account credentials (ideal for cloud deployments). |
| `VITE_API_URL` | Frontend | `http://localhost:5000` | Node.js backend HTTP API URL. |
| `VITE_SOCKET_URL` | Frontend | `http://localhost:5000` | Node.js WebSocket gateway URL. |

---

## 3. Google Cloud Configuration

To connect live Google Sheets synchronization:

1. **Create a Google Cloud Project**:
   - Go to the [Google Cloud Console](https://console.cloud.google.com/) and create a new project.
2. **Enable the Google Sheets API & Google Drive API**:
   - Navigate to **APIs & Services > Library**.
   - Search for **Google Sheets API** and click **Enable**.
   - Search for **Google Drive API** and click **Enable** (required: `gspread` and the Python service require the Google Drive API to locate spreadsheets, verify permissions, and fetch sheet metadata).
3. **Create a Service Account**:
   - Navigate to **APIs & Services > Credentials**.
   - Click **Create Credentials > Service Account**.
   - Name the service account (e.g. `sheets-sync-worker`) and click **Create and Continue**.
   - Assign the **Editor** role and finish.
4. **Generate JSON Key**:
   - Click on the created service account, navigate to the **Keys** tab, and select **Add Key > Create new key > JSON**.
   - Download the file and save it as `credentials.json` inside `backend-python/` (or set its raw contents to `GOOGLE_SERVICE_ACCOUNT_JSON` in your cloud environment).
5. **Share Your Google Sheet**:
   - Open your target Google Spreadsheet in your browser.
   - Click the **Share** button at the top right.
   - Add the service account email (e.g. `sheets-sync-worker@<project-id>.iam.gserviceaccount.com`) as an **Editor**.
   - Copy the Spreadsheet ID from the URL:
     `https://docs.google.com/spreadsheets/d/`**`<SPREADSHEET_ID>`**`/edit`

6. **Configure Spreadsheet ID via `/overview`**:
   - Open your browser and navigate to the **`/overview`** route (e.g. `http://localhost:5173/overview` or `https://syncgrid.intalix.in/overview`), or click **Overview / Settings** in the top navigation bar.
   - Enter your **Spreadsheet ID** and target **Sheet Name** (default: `Sheet1`).
   - Click **Save Configuration** (persisted dynamically in PostgreSQL with zero server restarts required).
   - Click **Test Connection** to immediately verify live Google API connectivity.
   - Use the **Force Sync** button in the top navigation bar whenever you want to trigger an instant sync pass.

---

## 4. How Synchronization Works

The platform delivers a robust bi-directional sync engine designed for low latency, data integrity, and conflict-free collaboration:

### A. Web Interface → Google Sheet
1. A user modifies a cell either directly inline or via the top formula bar and confirms (Enter, Tab, or clicking outside).
2. **Optimistic UI**: The local cell immediately reflects the new value with zero user-perceived delay.
3. The frontend dispatches `PUT /api/rows/:rowId` with the modified cells and the row's version checksum to Node.js.
4. Node.js updates PostgreSQL atomically using JSONB upserts and forwards the write to Python (`PUT /api/sheets/rows/:rowId`).
5. Python executes an authenticated `batch_update` via Google Sheets API v4 to write the cell into Google Sheets.
6. The change is broadcast over WebSockets to all other connected collaborators with remote visual cell highlights.

### B. Google Sheet → Web Interface (Dual-Channel Ingestion)
1. **Push Webhook Mode (< 300ms latency)**:
   - When configured with an optional Google Apps Script trigger (see Section 6), any user edit or cell deletion in Google Sheets fires an `onEdit(e)` event in Google's cloud.
   - The script sends an immediate HTTP `POST` webhook to `/api/webhook/sheets` on Node.js.
   - Node.js immediately persists the change in PostgreSQL and emits a `sheet_updated` WebSocket event to all clients.
2. **Pull Polling Mode (~1.5s – 3s latency fallback)**:
   - The Python `SheetsPoller` periodically inspects Google Sheets using checksum hashing.
   - When a discrepancy is detected, Python pushes the updated rows to `/internal/sync-event` on Node.js.
   - Node.js updates PostgreSQL using full-row replacement (pruning any deleted cells or columns) and notifies the clients.

### C. Concurrency Control & Conflict Resolution
- **Collaborator Presence**: When a collaborator focuses or types in a cell, their colored cursor badge and live typing indicator (`...typing`) are shown in real time, preventing concurrent collisions.
- **Optimistic Concurrency Control (OCC)**: Every row maintains an MD5 version checksum based on its cell contents. If two users edit the same row concurrently, or an external Google Sheets edit collides with a pending web edit, the server returns HTTP `409 Conflict`.
- **Interactive Conflict Resolution Modal**: When a conflict occurs, the user is presented with a side-by-side comparison of their attempted edit vs. the remote sheet state, with three options:
  1. *Keep Mine (Force Overwrite)*
  2. *Accept Google Sheet Version*
  3. *Review & Merge*

---

## 5. Local Setup & Installation

### Prerequisites
- **Node.js** (v18.0.0 or higher) & **npm**
- **Python** (v3.10 or higher) with `pip` or `uv`
- **PostgreSQL Database** (local instance or cloud database such as Neon, Supabase, or Railway)

### Quick Start: Automated Initialization
Run the initialization script matching your operating system. It checks all dependencies (Node.js, npm, nvm, Python 3.10+, pip/uv), initializes `.env`, and installs both Node workspaces and Python virtual environment packages:

```bash
# On Linux / macOS / Git Bash:
./init.sh

# On Windows (PowerShell):
.\init.ps1
```
*(By default it uses `pip`. You can optionally pass `--uv` / `-UseUv` to use `uv` if installed).*

---

### Manual Setup & Installation
```bash
git clone <your-repo-link>
cd bajaj-2
cp .env.example .env
```
Open `.env` and fill in your `DATABASE_URL` and Google credentials.

### Step 2: Install Node.js Dependencies & Seed Database
```bash
npm install
npm run db:seed
```

### Step 3: Set Up Python Virtual Environment
```bash
cd backend-python
python -m venv .venv

# On Windows:
.venv\Scripts\activate
# On macOS / Linux:
source .venv/bin/activate

pip install -e .
cd ..
```

### Step 4: Run Development Servers
You can run all services concurrently:
```bash
# Terminal 1: Python Engine
cd backend-python
.venv\Scripts\python -m app.main

# Terminal 2: Node.js Gateway & React Frontend
npm run dev
```
Open your browser at **`http://localhost:5173`**.
- Navigate to **`http://localhost:5173/overview`** (or click the **Overview / Settings** button in the top navigation bar) to connect your Google Sheet and test connectivity.
- Navigate to **`http://localhost:5173`** for the interactive real-time collaborative grid.

---

## 6. License
This project is licensed under the [MIT License](LICENSE).
