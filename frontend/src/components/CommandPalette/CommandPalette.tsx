import './CommandPalette.scss';
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Column, DueDateFilter, Task, ViewMode, ThemeMode } from '../../types';
import { PRIORITY_CONFIG, getDueDateInfo } from '../../utils/priorityDateUtils';

interface CommandItem {
  id: string;
  category: 'Navigation' | 'Actions' | 'Tasks';
  title: string;
  subtitle?: string;
  icon: string | React.ReactNode;
  shortcut?: string;
  badge?: string;
  badgeColor?: string;
  action: () => void;
}

interface CommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
  columns: Column[];
  deletedTasks: Task[];
  showDeletedCards: boolean;
  viewMode: ViewMode;
  onViewModeChange: (mode: ViewMode) => void;
  onToggleDeletedCards: () => void;
  onOpenNewTaskModal: (columnId?: string) => void;
  onStartAddColumn: () => void;
  onOpenTaskModal: (task: Task, isDeleted: boolean, columnId?: string) => void;
  onSetPriorityFilter: (priority: string) => void;
  onSetDueDateFilter: (filter: DueDateFilter) => void;
  onClearFilters: () => void;
  isFilterActive: boolean;
  onLogout: () => void;
  themeMode?: ThemeMode;
  onThemeModeChange?: (mode: ThemeMode) => void;
}

export const CommandPalette: React.FC<CommandPaletteProps> = ({
  isOpen,
  onClose,
  columns,
  deletedTasks,
  showDeletedCards,
  viewMode,
  onViewModeChange,
  onToggleDeletedCards,
  onOpenNewTaskModal,
  onStartAddColumn,
  onOpenTaskModal,
  onSetPriorityFilter,
  onSetDueDateFilter,
  onClearFilters,
  isFilterActive,
  onLogout,
  themeMode,
  onThemeModeChange,
}) => {
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  // Focus input and reset query on open
  useEffect(() => {
    if (isOpen) {
      setQuery('');
      setSelectedIndex(0);
      setTimeout(() => {
        inputRef.current?.focus();
      }, 50);
    }
  }, [isOpen]);

  // All active tasks flat list
  const allActiveTasks = useMemo(() => {
    const list: Array<{ task: Task; columnTitle: string; columnId: string }> = [];
    columns.forEach((col) => {
      col.tasks.forEach((t) => {
        list.push({ task: t, columnTitle: col.title, columnId: col.id });
      });
    });
    return list;
  }, [columns]);

  // Build commands list based on current query
  const filteredItems = useMemo(() => {
    const q = query.trim().toLowerCase();
    const items: CommandItem[] = [];

    // 1. Navigation items
    const navItems: CommandItem[] = [
      {
        id: 'nav-board',
        category: 'Navigation',
        title: 'Switch to Board View',
        subtitle: 'Kanban columns with drag-and-drop',
        icon: '📋',
        shortcut: 'B',
        badge: viewMode === 'board' ? 'Active' : undefined,
        action: () => {
          onViewModeChange('board');
          onClose();
        },
      },
      {
        id: 'nav-list',
        category: 'Navigation',
        title: 'Switch to List View',
        subtitle: 'Collapsible accordion groups',
        icon: '📑',
        shortcut: 'L',
        badge: viewMode === 'list' ? 'Active' : undefined,
        action: () => {
          onViewModeChange('list');
          onClose();
        },
      },
      {
        id: 'nav-table',
        category: 'Navigation',
        title: 'Switch to Table View',
        subtitle: 'Spreadsheet-style data table with sorting',
        icon: '📊',
        shortcut: 'T',
        badge: viewMode === 'table' ? 'Active' : undefined,
        action: () => {
          onViewModeChange('table');
          onClose();
        },
      },
      {
        id: 'nav-toggle-deleted',
        category: 'Navigation',
        title: showDeletedCards ? 'Hide Deleted Tasks' : 'Show Deleted Tasks',
        subtitle: `${deletedTasks.length} archived card${deletedTasks.length === 1 ? '' : 's'}`,
        icon: '🗑️',
        badge: deletedTasks.length > 0 ? `${deletedTasks.length} cards` : undefined,
        action: () => {
          onToggleDeletedCards();
          onClose();
        },
      },
    ];

    // 2. Action items
    const defaultColId = columns[0]?.id;
    const actionItems: CommandItem[] = [
      {
        id: 'act-new-task',
        category: 'Actions',
        title: 'Create New Task',
        subtitle: defaultColId ? `Add card to "${columns[0].title}"` : 'Add card to board',
        icon: '➕',
        action: () => {
          onOpenNewTaskModal(defaultColId);
          onClose();
        },
      },
      {
        id: 'act-new-column',
        category: 'Actions',
        title: 'Add New Column',
        subtitle: 'Append a new workflow column to the board',
        icon: '📁',
        action: () => {
          onStartAddColumn();
          onClose();
        },
      },
    ];

    if (onThemeModeChange) {
      actionItems.push(
        {
          id: 'act-theme-default',
          category: 'Actions',
          title: 'Theme: System Default',
          subtitle: 'Synchronize theme automatically with operating system',
          icon: '💻',
          badge: themeMode === 'default' ? 'Active' : undefined,
          action: () => {
            onThemeModeChange('default');
            onClose();
          },
        },
        {
          id: 'act-theme-dark',
          category: 'Actions',
          title: 'Theme: Sumi Ink & Muted Terracotta (Dark)',
          subtitle: 'Japanese Wabi-Sabi dark matte aesthetic',
          icon: '🌙',
          badge: themeMode === 'dark' ? 'Active' : undefined,
          action: () => {
            onThemeModeChange('dark');
            onClose();
          },
        },
        {
          id: 'act-theme-light',
          category: 'Actions',
          title: 'Theme: Shikkui Plaster & Ceramic Stoneware (Light)',
          subtitle: 'Japanese architectural limestone & ceramic light aesthetic',
          icon: '☀️',
          badge: themeMode === 'light' ? 'Active' : undefined,
          action: () => {
            onThemeModeChange('light');
            onClose();
          },
        }
      );
    }

    if (isFilterActive) {
      actionItems.push({
        id: 'act-clear-filters',
        category: 'Actions',
        title: 'Clear All Active Filters',
        subtitle: 'Reset search, priority, and due date filters',
        icon: '✕',
        action: () => {
          onClearFilters();
          onClose();
        },
      });
    }

    actionItems.push(
      {
        id: 'act-filter-critical',
        category: 'Actions',
        title: 'Filter: Critical Priority',
        subtitle: 'Only show cards marked Critical',
        icon: '🔴',
        action: () => {
          onSetPriorityFilter('critical');
          onClose();
        },
      },
      {
        id: 'act-filter-overdue',
        category: 'Actions',
        title: 'Filter: Overdue Due Dates',
        subtitle: 'Only show cards past their due date',
        icon: '⚠️',
        action: () => {
          onSetDueDateFilter('overdue');
          onClose();
        },
      },
      {
        id: 'act-filter-today',
        category: 'Actions',
        title: 'Filter: Due Today',
        subtitle: 'Only show cards due today',
        icon: '⚡',
        action: () => {
          onSetDueDateFilter('today');
          onClose();
        },
      },
      {
        id: 'act-logout',
        category: 'Actions',
        title: 'Log Out',
        subtitle: 'Sign out of current account',
        icon: '🚪',
        action: () => {
          onLogout();
          onClose();
        },
      }
    );

    const isSingleChar = q.length === 1;

    // Evaluate Navigation & Action commands with priority scoring
    interface ScoredCommand {
      item: CommandItem;
      score: number;
    }

    const scoredCommands: ScoredCommand[] = [];

    const evaluateCommand = (item: CommandItem) => {
      if (!q) {
        scoredCommands.push({ item, score: 0 });
        return;
      }

      const itemShortcut = item.shortcut?.toLowerCase();
      const titleLower = item.title.toLowerCase();
      const subtitleLower = item.subtitle?.toLowerCase() || '';

      // Highest Priority: Exact shortcut match (e.g. 'l' matches shortcut 'L')
      if (itemShortcut === q) {
        scoredCommands.push({ item, score: 200 });
        return;
      }

      if (isSingleChar) {
        // In single-character mode, do NOT do loose substring match across arbitrary words.
        // Only match if a distinct word in the title starts with that character.
        const words = titleLower.split(/[\s:_-]+/);
        if (words.some((w) => w.startsWith(q))) {
          scoredCommands.push({ item, score: 50 });
        }
        return;
      }

      // Multi-character query scoring
      if (titleLower.startsWith(q)) {
        scoredCommands.push({ item, score: 100 });
      } else if (titleLower.includes(q)) {
        scoredCommands.push({ item, score: 60 });
      } else if (subtitleLower.includes(q)) {
        scoredCommands.push({ item, score: 30 });
      }
    };

    navItems.forEach(evaluateCommand);
    actionItems.forEach(evaluateCommand);

    // Sort commands descending by score so exact shortcut matches appear at index 0
    scoredCommands.sort((a, b) => b.score - a.score);
    scoredCommands.forEach(({ item }) => items.push(item));

    // 3. Search Active Tasks
    if (q) {
      const matchedActive = allActiveTasks.filter(({ task, columnTitle }) => {
        const idMatch = task.id.toString() === q.replace(/^#/, '');
        if (idMatch) return true;

        const titleLower = task.title.toLowerCase();
        if (isSingleChar) {
          // In single-character mode, only match tasks if their title or words start with that letter
          const words = titleLower.split(/[\s:_-]+/);
          return words.some((w) => w.startsWith(q));
        }

        const titleMatch = titleLower.includes(q);
        const descMatch = task.description && task.description.toLowerCase().includes(q);
        const colMatch = columnTitle.toLowerCase().includes(q);
        return titleMatch || descMatch || colMatch;
      });

      matchedActive.slice(0, 15).forEach(({ task, columnTitle, columnId }) => {
        const priorityMeta = task.priority ? PRIORITY_CONFIG[task.priority] : null;
        const dueInfo = getDueDateInfo(task.dueDate);

        items.push({
          id: `task-${task.id}`,
          category: 'Tasks',
          title: task.title,
          subtitle: `In ${columnTitle}${dueInfo.status !== 'none' ? ` • ${dueInfo.badgeText}` : ''}`,
          icon: priorityMeta ? priorityMeta.icon : '📌',
          badge: `#${task.id}`,
          badgeColor: priorityMeta?.color,
          action: () => {
            onOpenTaskModal(task, false, columnId);
            onClose();
          },
        });
      });

      // 4. Search Deleted Tasks if showDeletedCards is active
      if (showDeletedCards && deletedTasks.length > 0) {
        const matchedDeleted = deletedTasks.filter((t) => {
          const idMatch = t.id.toString() === q.replace(/^#/, '');
          if (idMatch) return true;

          const titleLower = t.title.toLowerCase();
          if (isSingleChar) {
            const words = titleLower.split(/[\s:_-]+/);
            return words.some((w) => w.startsWith(q));
          }

          const titleMatch = titleLower.includes(q);
          const descMatch = t.description && t.description.toLowerCase().includes(q);
          return titleMatch || descMatch;
        });

        matchedDeleted.slice(0, 5).forEach((task) => {
          items.push({
            id: `del-task-${task.id}`,
            category: 'Tasks',
            title: task.title,
            subtitle: 'Deleted Card (Click to open / restore)',
            icon: '🗑️',
            badge: `#${task.id} (Deleted)`,
            action: () => {
              onOpenTaskModal(task, true);
              onClose();
            },
          });
        });
      }
    }

    return items;
  }, [
    query,
    viewMode,
    columns,
    deletedTasks,
    showDeletedCards,
    allActiveTasks,
    isFilterActive,
    onViewModeChange,
    onToggleDeletedCards,
    onOpenNewTaskModal,
    onStartAddColumn,
    onOpenTaskModal,
    onSetPriorityFilter,
    onSetDueDateFilter,
    onClearFilters,
    onLogout,
    onClose,
  ]);

  // Keep selected index in bounds when items list changes
  useEffect(() => {
    setSelectedIndex(0);
  }, [query]);

  // Keyboard navigation inside the palette
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev < filteredItems.length - 1 ? prev + 1 : 0));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev > 0 ? prev - 1 : filteredItems.length - 1));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (filteredItems[selectedIndex]) {
        filteredItems[selectedIndex].action();
      } else if (query.trim()) {
        // Quick create task with this query title
        onOpenNewTaskModal(columns[0]?.id);
        onClose();
      }
    } else if (e.key === 'Escape') {
      e.preventDefault();
      onClose();
    }
  };

  // Scroll active item into view
  useEffect(() => {
    if (!listRef.current) return;
    const activeEl = listRef.current.querySelector('.command-item-active') as HTMLElement;
    if (activeEl) {
      activeEl.scrollIntoView({ block: 'nearest' });
    }
  }, [selectedIndex]);

  if (!isOpen) return null;

  // Group items by category for visual headers
  let currentCategory = '';

  return (
    <div className="command-palette-backdrop" onClick={onClose}>
      <div
        className="command-palette-dialog"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="Command Palette"
      >
        <div className="command-palette-search">
          <svg
            className="command-search-icon"
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <input
            ref={inputRef}
            type="text"
            className="command-palette-input"
            placeholder="Type a command or search tasks (#ID, keyword)..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
          />
          <kbd className="command-esc-hint" onClick={onClose}>
            ESC
          </kbd>
        </div>

        <div ref={listRef} className="command-palette-list">
          {filteredItems.length === 0 ? (
            <div className="command-palette-empty">
              <span className="empty-icon">🔍</span>
              <p>No results found for &ldquo;{query}&rdquo;</p>
              <button
                type="button"
                className="btn-create-prompt"
                onClick={() => {
                  onOpenNewTaskModal(columns[0]?.id);
                  onClose();
                }}
              >
                + Create new task &ldquo;{query}&rdquo;
              </button>
            </div>
          ) : (
            filteredItems.map((item, index) => {
              const showCategory = item.category !== currentCategory;
              if (showCategory) {
                currentCategory = item.category;
              }
              const isActive = index === selectedIndex;

              return (
                <React.Fragment key={item.id}>
                  {showCategory && (
                    <div className="command-section-header">{item.category}</div>
                  )}
                  <div
                    className={`command-item ${isActive ? 'command-item-active' : ''}`}
                    onClick={item.action}
                    onMouseEnter={() => setSelectedIndex(index)}
                  >
                    <span className="command-item-icon">{item.icon}</span>
                    <div className="command-item-content">
                      <span className="command-item-title">{item.title}</span>
                      {item.subtitle && (
                        <span className="command-item-subtitle">{item.subtitle}</span>
                      )}
                    </div>
                    {item.badge && (
                      <span
                        className="command-item-badge"
                        style={item.badgeColor ? { borderColor: item.badgeColor, color: item.badgeColor } : {}}
                      >
                        {item.badge}
                      </span>
                    )}
                    {item.shortcut && (
                      <kbd
                        className={`command-item-shortcut ${
                          item.shortcut.toLowerCase() === query.trim().toLowerCase()
                            ? 'shortcut-matched'
                            : ''
                        }`}
                      >
                        {item.shortcut}
                      </kbd>
                    )}
                  </div>
                </React.Fragment>
              );
            })
          )}
        </div>

        <div className="command-palette-footer">
          <div className="footer-shortcut-hints">
            <span>
              <kbd>↑</kbd> <kbd>↓</kbd> Navigate
            </span>
            <span>
              <kbd>↵</kbd> Select
            </span>
            <span>
              <kbd>ESC</kbd> Close
            </span>
            <span>
              <kbd>B</kbd> <kbd>L</kbd> <kbd>T</kbd> Views
            </span>
          </div>
          <span className="footer-brand-hint">Bento Board</span>
        </div>
      </div>
    </div>
  );
};
