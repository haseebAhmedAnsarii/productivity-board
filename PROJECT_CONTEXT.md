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
- **Auto-Scroll to Add Column:** Clicking the header "+ Add Column" CTA (or the in-board "Add another column" button) smoothly scrolls the board horizontally to the far right, immediately focusing and bringing the column creation form into view.
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
  - **Auto-Scroll to Deleted Column:** Clicking the "Show Deleted Cards" CTA triggers a smooth horizontal scroll to the far right of the board area, immediately bringing the newly revealed `"Deleted"` column into full view.
- **Column Protections:**
  - Read-only column: cannot add cards directly to it, cannot drag cards into/out of it.
  - **Restore Confirmation Modal:** Clicking "Restore" (from the mini button on a deleted card or from inside the task modal) triggers a dedicated confirmation modal (`RestoreTaskModal`). It allows users to verify or select the target destination column (defaulting to the original column or resurrecting it) with clear visual feedback before restoring.
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

### I. Modular Component Architecture (`frontend/src/components/` & `types/`)
- **Refactored `page.tsx` from 1,070 lines down to ~270 lines** into clean, single-responsibility components:
  - [`frontend/src/types/index.ts`](file:///d:/practice/productivity-board/frontend/src/types/index.ts): Centralized TypeScript definitions for `Task`, `Column`, `HistoryItem`, and `SelectedTask`.
  - [`frontend/src/components/Header.tsx`](file:///d:/practice/productivity-board/frontend/src/components/Header.tsx): Header navigation, "Show/Hide Deleted Cards" CTA with counter, "+ Add Column" CTA, user avatar, and logout trigger.
  - [`frontend/src/components/AuthView.tsx`](file:///d:/practice/productivity-board/frontend/src/components/AuthView.tsx): Isolated login/registration form with tab switching and error display.
  - [`frontend/src/components/TaskCard.tsx`](file:///d:/practice/productivity-board/frontend/src/components/TaskCard.tsx): Draggable task card with numeric badge `#ID`, title, and description.
  - [`frontend/src/components/KanbanColumn.tsx`](file:///d:/practice/productivity-board/frontend/src/components/KanbanColumn.tsx): Droppable column wrapper with delete button, task cards, and "+ Add Task" button.
  - [`frontend/src/components/DeletedColumn.tsx`](file:///d:/practice/productivity-board/frontend/src/components/DeletedColumn.tsx): Dedicated soft-deleted column with `forwardRef` for auto-scrolling into view and mini "Restore" action.
  - [`frontend/src/components/AddColumn.tsx`](file:///d:/practice/productivity-board/frontend/src/components/AddColumn.tsx): Inline add-column button and form with validation error handling.
  - [`frontend/src/components/TaskModal.tsx`](file:///d:/practice/productivity-board/frontend/src/components/TaskModal.tsx): Task details modal supporting creation, editing, in-modal column moving with "Move Now", deletion confirmation, restoration, and expandable activity history timeline with formatted timestamps and seconds.
  - [`frontend/src/components/DeleteColumnModal.tsx`](file:///d:/practice/productivity-board/frontend/src/components/DeleteColumnModal.tsx): Confirmation modal when deleting a column with task-count warnings.
  - [`frontend/src/components/LogoutModal.tsx`](file:///d:/practice/productivity-board/frontend/src/components/LogoutModal.tsx): Confirmation dialog before terminating user session.
  - [`frontend/src/components/RestoreTaskModal.tsx`](file:///d:/practice/productivity-board/frontend/src/components/RestoreTaskModal.tsx): Confirmation dialog before restoring a deleted card, with destination column selector and resurrection notice.
  - [`frontend/src/components/index.ts`](file:///d:/practice/productivity-board/frontend/src/components/index.ts): Central barrel export.

### J. Modular Backend Architecture (`backend/routes/`, `middleware/`, `services/`, `sockets/`)
- **Refactored `server.ts` from 532 lines down to ~35 lines** into decoupled, dedicated architectural modules:
  - [`backend/config.ts`](file:///d:/practice/productivity-board/backend/config.ts): Centralized environment constants (`PORT`, `JWT_SECRET`).
  - [`backend/middleware/auth.ts`](file:///d:/practice/productivity-board/backend/middleware/auth.ts): Typed JWT authentication middleware and `AuthenticatedRequest` interface.
  - [`backend/services/history.ts`](file:///d:/practice/productivity-board/backend/services/history.ts): Reusable audit logging service (`logTaskHistory`) for title, description, moved, deleted, and restored events.
  - [`backend/routes/auth.ts`](file:///d:/practice/productivity-board/backend/routes/auth.ts): Dedicated router for `/api/auth/register` and `/api/auth/login`.
  - [`backend/routes/boards.ts`](file:///d:/practice/productivity-board/backend/routes/boards.ts): Dedicated router for fetching board hierarchy, active columns, and soft-deleted cards (`/api/boards`).
  - [`backend/routes/columns.ts`](file:///d:/practice/productivity-board/backend/routes/columns.ts): Dedicated router for column creation and soft-deletion (`/api/columns`, `/api/columns/:id`).
  - [`backend/routes/tasks.ts`](file:///d:/practice/productivity-board/backend/routes/tasks.ts): Dedicated router for task creation, editing, in-modal moving, soft-deletion, restoration, and history queries (`/api/tasks`).
  - [`backend/routes/index.ts`](file:///d:/practice/productivity-board/backend/routes/index.ts): Master API router mounting sub-routers under `/api`.
  - [`backend/sockets/boardSocket.ts`](file:///d:/practice/productivity-board/backend/sockets/boardSocket.ts): Socket.IO connection authentication, `join_board`, `move_task` ordering, and broadcast events.
  - [`backend/server.ts`](file:///d:/practice/productivity-board/backend/server.ts): Clean, high-level server entry point orchestrating Express, Socket.IO, DB initialization, and HTTP listen.

### K. Multi-View Architecture (Board, List, Table)
- **View Switcher (`viewMode: 'board' | 'list' | 'table'`):**
  - Integrated into the header with tactile segmented control buttons (icons + text).
  - Persists active mode and enables instant context-switching across all representations.
- **Board View:**
  - Classic Kanban multi-column drag-and-drop workflow with `@hello-pangea/dnd`, horizontal scrolling, and dedicated soft-deleted column.
- **List View ([`ListView.tsx`](file:///d:/practice/productivity-board/frontend/src/components/ListView.tsx)):**
  - Structured vertical group cards for each column with task counters and "+ Add Task" shortcuts.
  - Interactive rows with `#ID` badges, titles, descriptions, quick column switcher dropdowns, and edit action.
  - Dedicated "Deleted Tasks" group when soft-deleted cards exist and are toggled visible.
- **Table View ([`TableView.tsx`](file:///d:/practice/productivity-board/frontend/src/components/TableView.tsx)):**
  - Spreadsheet-like table with real-time search input (filtering by title or description).
  - Column filter dropdown ("All Columns" or specific columns).
  - Sortable columns (`#ID`, `Title`, `Column`) with ascending/descending indicators.
  - Direct column reassignment dropdown per row, syncing instantaneously via WebSockets.
  - Highlights soft-deleted cards with strike-through and a mini "Restore" button triggering `RestoreTaskModal`.

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

### I. Modular Component Architecture & Backend Decomposition
- **Frontend Decomposition:** The monolithic `page.tsx` was broken down into focused single-responsibility components in `frontend/src/components/`:
  - `Header.tsx`, `AuthView.tsx`, `TaskCard.tsx`, `KanbanColumn.tsx`, `DeletedColumn.tsx`, `AddColumn.tsx`, `TaskModal.tsx`, `DeleteColumnModal.tsx`, `LogoutModal.tsx`, `RestoreTaskModal.tsx`, `ListView.tsx`, and `TableView.tsx`.
- **Backend Decomposition:** The monolithic `server.ts` was modularized into clean directories:
  - `config.ts` (environment, ports, JWT secrets).
  - `middleware/auth.ts` (`authenticateToken`).
  - `services/history.ts` (`logTaskHistory`).
  - `routes/` (`authRoutes.ts`, `boardRoutes.ts`, `columnRoutes.ts`, `taskRoutes.ts`, `index.ts`).
  - `sockets/boardSocket.ts` (Socket.IO event handlers and real-time room dispatch).

### J. Multi-View Architecture (Board, List, Table) & Universal Add Column
- **Segmented View Switcher:** Header segmented pill controller allowing switching between **Board**, **List**, and **Table** views.
- **List View Scrolling & Content Cropping Fix:**
  - **Flex Squeeze & Cropping Resolution:** Flexbox children default to `flex-shrink: 1`. In `.list-view-container`, when columns exceeded available screen height, flexbox squeezed each `.list-group` to fit within the viewport, causing cards beyond the squeezed height to be chopped off by `.list-group`'s `overflow: hidden`, preventing the scrollbar from ever triggering, and squeezing the top columns further when "Show Deleted Cards" was clicked.
  - **The Fix:** Added `flex-shrink: 0;` to `.list-group`, `.list-group-header`, `.list-task-row` (`min-height: 52px`), `.list-add-column-section`, `.table-toolbar`, `.table-card-container`, and `.table-add-column-section`.
  - **Single-Fold Contrast Wrapper & Single Outer Scrollbar:** The outer main page vertical scroll is strictly eliminated (`overflow: hidden;` on `.list-view-container` and `.table-view-container`). In List View, all columns, deleted tasks, and the add column section are wrapped into a single unified contrast panel (`.list-card-container` with `background: #14161a; border: 1px solid var(--border-ui); border-radius: var(--radius-column); padding: 1rem 1.25rem 1rem 1rem; gap: 1rem;`). The inner column scrollbar (`overflow-y: auto; max-height: 300px;` on `.list-task-items`) was removed, allowing each column to expand naturally according to its tasks, leaving `.list-card-container`'s outer scrollbar as the sole vertical scrollbar for the view.
  - **Text Wrapping & Collapse:** Enhanced title and description text wrapping using multi-line clamp (`-webkit-line-clamp: 2`) and added interactive collapsible/expandable column sections with chevron toggles (`▼` / `▶`).
  - **Text Truncation & 2-Line Ellipsis:** Applied 2-line ellipsis clamping (`display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; word-break: break-word;`) to `.list-task-title`, `.table-task-title`, and `.table-task-desc`, with `table-layout: fixed;` on `.kanban-table`. Added browser tooltip `title` attributes on all elements for full readability on hover.
- **Universal "+ Add Column" Support:**
  - Clicking "+ Add Column" in the header or in-view CTA now works consistently across all views (Board, List, Table).
  - Automatically scrolls to the column creation form (`block: 'center'` for vertical views, `inline: 'end'` for horizontal board) and auto-focuses the input, with full Escape key cancel support.

### K. Board View Minimap Horizontal Scroller
- **Purpose:** Replaced the browser's default horizontal scrollbar on `.board-area` with an interactive, gaming/IDE-style horizontal minimap navigator.
- **Component:** [`BoardMinimap.tsx`](file:///d:/practice/productivity-board/frontend/src/components/BoardMinimap.tsx) mounted inside `.board-view-wrapper`.
- **Key Features:**
  - **Live Miniature Column Previews:** Displays scaled micro-representations of every active board column, showing column accents, titles, task density indicators (mini card bars + overflow badge count), the soft-deleted column (when visible), and the "+ Add Column" slot.
  - **Interactive Viewport Lens:** A translucent amber viewport slider representing the visible proportion of the board canvas (`clientWidth / scrollWidth`).
  - **Fluid Real-time Dragging:** Dragging the lens pans the board smoothly in real-time, clamping precisely to the board's bounds.
  - **Click-to-Jump Navigation:** Clicking anywhere on the minimap track or directly on a mini column immediately scrolls the board canvas smoothly to that exact column position.
  - **Step Scrolling Buttons:** Tactile left/right stepper buttons (`◀` and `▶`) scroll by one column width (`350px`) with disabled states when at the scroll boundaries.
  - **Collapsible Minimap Pill:** Users can collapse the full minimap into a sleek floating pill (`[🗺️ Minimap <count>]`) and expand it on demand, with a close button (`✕`) on the bar.
  - **Hidden Native Scrollbar & Responsive Clearance:** The native scrollbar on `.board-area` is hidden via `scrollbar-width: none; ::-webkit-scrollbar { display: none; }`. Adjusted `.kanban-column` `max-height` to `calc(100vh - 10.25rem)` with `.board-area` `padding: 1.25rem 2rem 5.25rem;` and a sleeker 44px minimap profile (`bottom: 0.85rem`), plus `@media (max-height: 760px)` responsive adaptation. This ensures center columns and their "+ Add Task" CTA buttons always have clear breathing space above the floating minimap on all laptop screen sizes.

### L. Rich Text Task Descriptions
- **Components:**
  - [`RichTextEditor.tsx`](file:///d:/practice/productivity-board/frontend/src/components/RichTextEditor.tsx): Full-featured interactive editor with tri-mode switcher (**Visual WYSIWYG**, **Markdown Source**, and **Rendered Preview**).
  - [`RichTextRenderer.tsx`](file:///d:/practice/productivity-board/frontend/src/components/RichTextRenderer.tsx): Safe XSS-sanitized HTML and Markdown parser/renderer.
  - `stripRichTextToSnippet`: Utility extracting clean, unformatted plain-text excerpts for compact card and table previews.
- **Key Features:**
  - **Comprehensive Formatting Toolbar:** Bold (`Ctrl+B`), Italic (`Ctrl+I`), Underline (`Ctrl+U`), Strikethrough, Highlight badge, Headings (`H1`, `H2`, `H3`), Bullet lists, Numbered lists, Interactive task checklists (`[ ]` / `[x]`), Blockquotes, Code blocks / inline code, Horizontal dividers, Link dialog (`Ctrl+K`), Undo (`Ctrl+Z`), and Clear Formatting.
  - **Multi-View Integration:**
    - **Modal View:** Full rich text editing and preview inside [`TaskModal.tsx`](file:///d:/practice/productivity-board/frontend/src/components/TaskModal.tsx), defaulting to **Preview** mode upon card opening for a clean formatted reading experience. Clicking formatting toolbar buttons, clicking the Visual tab, or double-clicking the preview canvas switches seamlessly to Visual editing mode. Dedicated read-only view badge for deleted cards.
    - **Board, List & Table Views:** Cards in [`TaskCard.tsx`](file:///d:/practice/productivity-board/frontend/src/components/TaskCard.tsx), [`DeletedColumn.tsx`](file:///d:/practice/productivity-board/frontend/src/components/DeletedColumn.tsx), [`ListView.tsx`](file:///d:/practice/productivity-board/frontend/src/components/ListView.tsx), and [`TableView.tsx`](file:///d:/practice/productivity-board/frontend/src/components/TableView.tsx) display clean 2-line clamped snippets with tooltip hover, preventing layout distortion while preserving rich text within modal views.
  - **Accurate Selection Preservation & Interactive Links:**
    - Range/selection is saved before the link modal opens and restored on submission (`Range.insertNode(aTag)` in Visual mode, cursor-offset splice in Markdown mode), preventing links from ever jumping to the beginning of the text.
    - Inside Visual WYSIWYG mode, clicking any link displays an interactive floating popover (`[🔗 url] [↗ Open] [✎ Edit] [✕ Unlink]`) and supports `Ctrl+Click` / `Cmd+Click` to open immediately. In Preview and Read-Only modes, links are standard clickable external anchors (`target="_blank" rel="noopener noreferrer"`).
    - **HTML-Tag Protection & Idempotent Sanitization:** `parseAndSanitizeRichText` protects all existing `<...>` HTML tags before executing markdown inline transforms (such as `_..._` or `**...**`), preventing markdown regexes from matching inside tag attributes (e.g., `target="_blank"`). Automatically heals any legacy corrupted link attribute leakage (`[blank" rel="... title="...">a](url)`) in both rendered HTML and card snippets.
  - **Zero Migration Database Compatibility:** Works seamlessly with SQLite's `TEXT` column and existing plain text descriptions without schema alterations.
  - **Granular Activity & History Diffing:**
    - Title updates display exact changes: `Renamed title from ~"old"~ to **"new"**`.
    - Description updates display sanitized from-to changes matching title: `Updated description from ~"old snippet"~ to **"new snippet"**`, with hover tooltips and an interactive accordion toggle (`[Show full]`/`[Show less]`) to inspect full multi-line edits without cluttering the audit timeline.


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

