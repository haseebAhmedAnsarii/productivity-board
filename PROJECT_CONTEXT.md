# Productivity Board — Complete Project History & Context Handoff

This document summarizes the full context, architectural evolution, implemented features, and technical details of the **Productivity Board** application. Use this document when starting a new chat session to continue development seamlessly.

---

## 1. Project Overview & Tech Stack

A full-stack, real-time Kanban productivity web application with per-user persistent boards and cards.

- **Frontend:**
  - **Framework:** Next.js 16 (App Router, React 19)
  - **Styling:** Vanilla CSS (`globals.css`) with custom CSS variables and utility design tokens (No Tailwind, no generic templates).
  - **Real-time:** `socket.io-client`
  - **Drag and Drop:** HTML5 Drag & Drop API with custom drop indicators and state management.
  - **Location:** `d:\practice\productivity-board\frontend` (running on `http://localhost:3000` / `http://localhost:3001`).

- **Backend:**
  - **Framework:** Node.js with Express & TypeScript (`server.ts` executed via `tsx`).
  - **Real-time:** `socket.io` broadcasting column, card, and history changes.
  - **Database:** SQLite (`database.sqlite`) via `sqlite3` and `sqlite` promise wrapper (`db.ts`).
  - **Authentication:** JWT tokens (`jsonwebtoken`) stored in `localStorage`, bcrypt password hashing.
  - **Location:** `d:\practice\productivity-board\backend` (running on `http://localhost:4000`).

---

## 2. Key Features & Implementation Details

### A. Bespoke Architectural Design System (Anti "AI Slop")
- **Palette:** Warm Obsidian Architectural aesthetic:
  - Deep carbon base: `#121316` (background)
  - Elevated surfaces: `#181a1f`, `#1e2128`
  - Subtle architectural borders: `#282c35`, `#333844`
  - High-contrast warm text: `#edece6`, `#9ca3af` (no text gradients)
  - Warm amber/gold accents: `#d97706`, `#f59e0b` (removed all generic cyan, purple, and aurora glows)
- **Geometry & Hierarchy:** Dynamic, varied border-radii (4px for tags, 6px for buttons, 10px for cards, 14px for modals/columns) instead of uniform rounded corners.
- **Card Layout:** Fixed text-overflow protection with CSS ellipsis, robust flex constraints preventing cards from collapsing or shrinking horizontally.

### B. Dynamic Column Management
- Add custom columns to the board.
- **Delete Column:**
  - Confirmation prompt before deletion.
  - When a column is deleted, the column itself is soft-deleted (`is_deleted = 1` in `columns`), and all cards within it are transferred to the **"Deleted"** column (`is_deleted = 1, column_id = NULL, original_column_id = column.id`).
  - Deleting a column creates an audit log for every moved card in `task_history` recording the originating column name (`Column "X" was deleted`).
  - Calls `fetchBoard()` immediately upon column deletion so the Deleted column, its cards, and header badge count update instantly without requiring a page refresh.
  - Syncs via backend `DELETE /api/columns/:id` and broadcasts via WebSocket.

### C. Soft-Delete, Smart "Deleted" Column & Original Column Restoration
- Cards cannot be permanently deleted from active columns. Deleting a card moves it into a dedicated `"Deleted"` column (`is_deleted = 1`).
- **Conditional Visibility:**
  - The `"Deleted"` column is hidden by default.
  - It only becomes available when at least one deleted card exists.
  - Even when cards exist, it remains hidden until the user clicks the header button: **"Show Deleted Cards"** (`"Hide Deleted Cards"` once visible).
- **Column Protections:**
  - Read-only column: cannot add cards directly to it, cannot drag cards into/out of it.
  - Cards inside have a **"Restore"** action.
- **Original Column Restoration:**
  - When a card whose entire column was deleted is restored, the backend automatically resurrects the original column (`UPDATE columns SET is_deleted = 0`) or recreates it if it was previously hard-deleted.
  - The card is placed directly back into its original column (rather than falling back to the "To Do" column).
  - Activity history correctly logs the restored column name (`Restored card back to column "<title>"`).

### D. Card Edit & Activity History
- Opening a card displays a comprehensive **Activity & History** log at the bottom of the modal.
- Logs events:
  - Card creation (`created`)
  - Title edits (`title`)
  - Description changes (`description`)
  - Column transfers (`moved`)
  - Soft deletions (`deleted`)
  - Restorations (`restored`)
- Displays author username, exact before-and-after values, and local timestamps.

### E. Timezone Accuracy & AM/PM Formatting
- **Root Cause Fixed:** SQLite stores `CURRENT_TIMESTAMP` as UTC string without timezone offset (`YYYY-MM-DD HH:MM:SS`), which browsers previously misparsed as local time (causing a 5-hour offset in UTC+5).
- **Backend Fix:** Writes standard ISO strings (`new Date().toISOString()`) for new `task_history` rows.
- **Frontend Normalizer:** `formatHistoryTime` uses regex `/[Zz]$|[+-]\d{2}(:?\d{2})?$/` to detect missing offsets and parse as UTC.
- **AM/PM Formatting with Seconds:** Formatted via `toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', second: '2-digit', hour12: true })` yielding clean, precise timestamps like `Oct 13, 3:44:12 PM`.

### F. Unique Card ID / Number Badges
- **Style:** Clean numeric badge (e.g. `#4`, `#12`) using the task's unique auto-increment identifier.
- **Card Header:** Displayed at the top-left of each task card in a monospace badge (`var(--font-mono)`).
- **Deleted Cards:** Displayed in red-accented badge style for soft-deleted cards.
- **Task Modal Header:** Displayed alongside the modal title (`#ID`), with a one-click copy button that copies the `#ID` to clipboard with visual "Copied!" feedback.
- **Bespoke Obsidian Theme Integration:** Subtly shifts to warm amber accent (`--accent`) on card hover for tactile responsiveness.

### G. Move To Column via Task Modal
- **In-Modal Column Selector:** A bespoke dropdown in the task modal allowing moving active cards to any board column without drag-and-drop.
- **Current Column Indication:** The card's existing column is marked with `(Current)`.
- **Dual Move Workflows:**
  - **Quick Move:** Selecting a new column reveals a tactile "Move Now" shortcut button for instant movement.
  - **Save Changes:** Users can also edit title, description, and column simultaneously and save them together with "Save Changes".
- **Real-time Sync & Audit Trail:**
  - Moves made from the modal log a `moved` audit history entry (`Moved card from "<Source>" to "<Destination>"`).
  - Broadcasts via WebSocket (`task_updated`) to sync all open clients immediately.
- **Read-Only on Deleted Cards:** When viewing a soft-deleted card, the column dropdown is disabled with `cursor: not-allowed` styling, displaying the card's original column.

### H. Modal Height Bounds & Resizable Textarea Scroll Constraints
- **Modal Overflow Protection:** `.modal-content` is capped with `max-height: calc(100vh - 3rem)` and `overflow-y: auto`, preventing the modal from expanding beyond the viewport when inner elements grow.
- **Textarea Resize Handling:** Resizing the textarea via its bottom-right handle expands content within the modal; once the modal hits its viewport boundary, a custom scrollbar appears instead of pushing header or action buttons off-screen.
- **Persistent Header & Button Rows:** `.modal-header` and action button rows have `flex-shrink: 0` so they never collapse or become unclickable.

---

## 3. Database Schema (`backend/database.sqlite`)

```sql
-- Users
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT UNIQUE NOT NULL,
  password TEXT NOT NULL
);

-- Boards
CREATE TABLE IF NOT EXISTS boards (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  user_id INTEGER NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users (id)
);

-- Columns
CREATE TABLE IF NOT EXISTS columns (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  board_id INTEGER NOT NULL,
  title TEXT NOT NULL,
  position INTEGER NOT NULL,
  FOREIGN KEY (board_id) REFERENCES boards (id)
);

-- Tasks
CREATE TABLE IF NOT EXISTS tasks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  column_id INTEGER NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  position INTEGER NOT NULL,
  is_deleted INTEGER DEFAULT 0,
  deleted_at DATETIME,
  original_column_id INTEGER,
  FOREIGN KEY (column_id) REFERENCES columns (id)
);

-- Task History / Activity Log
CREATE TABLE IF NOT EXISTS task_history (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  task_id INTEGER NOT NULL,
  user_id INTEGER NOT NULL,
  username TEXT NOT NULL,
  change_type TEXT NOT NULL,
  old_value TEXT,
  new_value TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (task_id) REFERENCES tasks (id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users (id)
);
```

---

## 4. API & Socket Overview

### Backend Endpoints (`server.ts`):
- `POST /api/auth/register` & `POST /api/auth/login`
- `GET /api/boards` — returns board columns and any deleted tasks.
- `POST /api/columns` & `DELETE /api/columns/:id`
- `POST /api/tasks` — creates task & logs `created` history.
- `PUT /api/tasks/:id` — updates title/description & logs changes.
- `PUT /api/tasks/:id/move` — updates column/position & logs `moved` history.
- `DELETE /api/tasks/:id` — soft deletes (moves to deleted, sets `is_deleted = 1`) & logs `deleted`.
- `POST /api/tasks/:id/restore` — restores soft-deleted task & logs `restored`.
- `GET /api/tasks/:id/history` — fetches chronological audit log for a card.

### Socket.io Events:
- `board-updated` — emitted on column or task changes to update all clients in real-time.
- `history-updated` — emitted when a task activity occurs.

---

## 5. Important Environment Gotchas & Conventions
1. **Workspace Path:** The folder on disk is `d:\practice\productivity-board`.
2. **File Edits in Current Session:** Direct IDE file modification tools hit permission restrictions if the IDE was opened with the old path `d:\practice\New folder`. To modify files in this workspace, use Node.js scripts executed via terminal commands (`run_command`), or open a New Chat after opening `d:\practice\productivity-board` directly in the IDE.
3. **Running Terminals:**
   - Frontend dev server running on port 3000 / 3001.
   - Backend running on port 4000 via `npx tsx server.ts`.
