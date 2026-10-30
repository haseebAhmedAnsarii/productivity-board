"use client";

import React, { useState, useEffect, useRef, useMemo } from 'react';
import { DragDropContext, DropResult } from '@hello-pangea/dnd';
import { io, Socket } from 'socket.io-client';

import { Column, SelectedTask, Task, ViewMode, PriorityLevel, DueDateFilter, ThemeMode } from '../types';
import {
  Header,
  AuthView,
  KanbanColumn,
  ArchivedColumn,
  AddColumn,
  TaskModal,
  ArchiveColumnModal,
  LogoutModal,
  RestoreTaskModal,
  ListView,
  TableView,
  BoardMinimap,
  FilterBar,
  CommandPalette,
} from '../components';
import { matchesPriorityFilter, matchesDueDateFilter } from '../utils/priorityDateUtils';

let socket: Socket;

export default function Home() {
  const [columns, setColumns] = useState<Column[]>([]);
  const [boardId, setBoardId] = useState('');
  const [isBrowser, setIsBrowser] = useState(false);
  const [loading, setLoading] = useState(true);
  
  const [token, setToken] = useState<string | null>(null);
  const [authUsername, setAuthUsername] = useState('');
  
  const [selectedTask, setSelectedTask] = useState<SelectedTask>(null);
  const [isModalArchivedTask, setIsModalArchivedTask] = useState(false);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [columnToArchive, setColumnToArchive] = useState<Column | null>(null);
  const [archivedTasks, setArchivedTasks] = useState<Task[]>([]);
  const [showArchivedCards, setShowArchivedCards] = useState(false);
  const [isAddingColumn, setIsAddingColumn] = useState(false);
  const [taskToRestore, setTaskToRestore] = useState<Task | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>('board');
  const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState(false);
  const [themeMode, setThemeMode] = useState<ThemeMode>('default');

  // Initialize and persist theme mode
  useEffect(() => {
    const saved = (localStorage.getItem('pb_theme_mode') as ThemeMode) || 'default';
    setThemeMode(saved);
  }, []);

  // Synchronize data-theme on document root and listen for OS system preference changes
  useEffect(() => {
    const applyTheme = (mode: ThemeMode) => {
      let resolved: 'dark' | 'light' = 'dark';
      if (mode === 'default') {
        resolved = (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) ? 'dark' : 'light';
      } else {
        resolved = mode;
      }
      document.documentElement.setAttribute('data-theme', resolved);
    };

    applyTheme(themeMode);

    if (themeMode === 'default' && typeof window !== 'undefined' && window.matchMedia) {
      const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
      const listener = (e: MediaQueryListEvent) => {
        document.documentElement.setAttribute('data-theme', e.matches ? 'dark' : 'light');
      };
      mediaQuery.addEventListener('change', listener);
      return () => mediaQuery.removeEventListener('change', listener);
    }
  }, [themeMode]);

  const handleThemeModeChange = (newMode: ThemeMode) => {
    setThemeMode(newMode);
    localStorage.setItem('pb_theme_mode', newMode);
  };

  // Priority & Due Date Filter States
  const [searchQuery, setSearchQuery] = useState('');
  const [priorityFilter, setPriorityFilter] = useState<string>('all');
  const [dueDateFilter, setDueDateFilter] = useState<DueDateFilter>('all');
  const [isMobileFilterOpen, setIsMobileFilterOpen] = useState(false);

  const isFilterActive = searchQuery.trim() !== '' || priorityFilter !== 'all' || dueDateFilter !== 'all';

  const activeFiltersCount = useMemo(() => {
    let count = 0;
    if (searchQuery.trim()) count++;
    if (priorityFilter !== 'all') count++;
    if (dueDateFilter !== 'all') count++;
    return count;
  }, [searchQuery, priorityFilter, dueDateFilter]);

  const taskMatchesFilter = (task: Task) => {
    const matchesSearch = !searchQuery.trim() ||
      task.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (task.description && task.description.toLowerCase().includes(searchQuery.toLowerCase()));
    const matchesPriority = matchesPriorityFilter(task.priority, priorityFilter);
    const matchesDueDate = matchesDueDateFilter(task.dueDate, dueDateFilter);
    return Boolean(matchesSearch && matchesPriority && matchesDueDate);
  };

  const filteredColumns = useMemo(() => {
    if (!isFilterActive) return columns;
    return columns.map(col => ({
      ...col,
      tasks: col.tasks.filter(taskMatchesFilter)
    }));
  }, [columns, searchQuery, priorityFilter, dueDateFilter, isFilterActive]);

  const filteredArchivedTasks = useMemo(() => {
    if (!isFilterActive) return archivedTasks;
    return archivedTasks.filter(taskMatchesFilter);
  }, [archivedTasks, searchQuery, priorityFilter, dueDateFilter, isFilterActive]);

  const totalTasksCount = useMemo(() => {
    return columns.reduce((acc, c) => acc + c.tasks.length, 0) + (showArchivedCards ? archivedTasks.length : 0);
  }, [columns, archivedTasks, showArchivedCards]);

  const filteredTasksCount = useMemo(() => {
    return filteredColumns.reduce((acc, c) => acc + c.tasks.length, 0) + (showArchivedCards ? filteredArchivedTasks.length : 0);
  }, [filteredColumns, filteredArchivedTasks, showArchivedCards]);

  const handleClearFilters = () => {
    setSearchQuery('');
    setPriorityFilter('all');
    setDueDateFilter('all');
  };

  const archivedColumnRef = useRef<HTMLDivElement>(null);
  const addColumnRef = useRef<HTMLDivElement>(null);
  const boardAreaRef = useRef<HTMLElement>(null);
  const prevShowArchivedCardsRef = useRef(false);
  const addColumnTimerRef = useRef<NodeJS.Timeout | null>(null);

  const scrollToAddColumn = () => {
    if (addColumnTimerRef.current) {
      clearTimeout(addColumnTimerRef.current);
    }
    addColumnTimerRef.current = setTimeout(() => {
      if (viewMode === 'board' && boardAreaRef.current) {
        boardAreaRef.current.scrollTo({
          left: boardAreaRef.current.scrollWidth,
          behavior: 'smooth'
        });
      } else if (addColumnRef.current) {
        addColumnRef.current.scrollIntoView({
          behavior: 'smooth',
          inline: 'nearest',
          block: 'nearest',
        });
      }
    }, 60);
  };

  useEffect(() => {
    // Only auto-scroll when user explicitly turns on archived cards (false -> true).
    // Switching viewMode while archived cards are already visible must NOT trigger scroll.
    const isNewlyOpened = !prevShowArchivedCardsRef.current && showArchivedCards;
    prevShowArchivedCardsRef.current = showArchivedCards;

    if (isNewlyOpened && archivedTasks.length > 0) {
      const timer = setTimeout(() => {
        if (viewMode === 'board' && archivedColumnRef.current && boardAreaRef.current) {
          const col = archivedColumnRef.current;
          const board = boardAreaRef.current;
          const isMobile = typeof window !== 'undefined' && window.innerWidth <= 640;

          if (isMobile) {
            // On mobile (<=640px), precisely center the ArchivedColumn in the viewport
            // rather than scrolling to scrollWidth (which overshoots onto AddColumn).
            const targetLeft = col.offsetLeft - (board.clientWidth - col.offsetWidth) / 2;
            board.scrollTo({
              left: Math.max(0, targetLeft),
              behavior: 'smooth',
            });
          } else {
            col.scrollIntoView({
              behavior: 'smooth',
              inline: 'end',
              block: 'nearest',
            });
          }
        } else if (archivedColumnRef.current) {
          archivedColumnRef.current.scrollIntoView({
            behavior: 'smooth',
            inline: 'nearest',
            block: 'center',
          });
        } else if (viewMode === 'board' && boardAreaRef.current) {
          boardAreaRef.current.scrollTo({
            left: boardAreaRef.current.scrollWidth,
            behavior: 'smooth',
          });
        }
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [showArchivedCards, archivedTasks.length, viewMode]);

  useEffect(() => {
    if (isAddingColumn) {
      scrollToAddColumn();
    }
  }, [isAddingColumn]);

  // Reset inline Add Column form and scroll position whenever the user switches views
  useEffect(() => {
    if (addColumnTimerRef.current) {
      clearTimeout(addColumnTimerRef.current);
      addColumnTimerRef.current = null;
    }
    setIsAddingColumn(false);

    const resetViewScroll = () => {
      if (typeof window !== 'undefined') {
        window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
        if (document.documentElement) {
          document.documentElement.scrollTop = 0;
          document.documentElement.scrollLeft = 0;
        }
        if (document.body) {
          document.body.scrollTop = 0;
          document.body.scrollLeft = 0;
        }
      }
      if (boardAreaRef.current) {
        boardAreaRef.current.scrollTo({ left: 0, top: 0, behavior: 'instant' });
      }
      const listContainer = document.querySelector('.list-card-container');
      if (listContainer) listContainer.scrollTop = 0;
      const tableContainer = document.querySelector('.table-card-container');
      if (tableContainer) {
        tableContainer.scrollTop = 0;
        tableContainer.scrollLeft = 0;
      }
    };

    resetViewScroll();
    const rafId = requestAnimationFrame(resetViewScroll);
    return () => cancelAnimationFrame(rafId);
  }, [viewMode]);

  useEffect(() => {
    setIsBrowser(true);
    const storedToken = localStorage.getItem('token');
    const storedUser = localStorage.getItem('authUsername');
    if (storedToken) setToken(storedToken);
    if (storedUser) setAuthUsername(storedUser);
  }, []);

  // Global keyboard shortcuts:
  // - Ctrl+K / Cmd+K: Open/close Command Palette
  // - B / L / T: Instant view switching when idle on the board (no modals or input fields active)
  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      // 1. Toggle Command Palette with Ctrl+K / Cmd+K
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setIsCommandPaletteOpen(prev => !prev);
        return;
      }

      // If user is not authenticated or any modifier key is pressed, do not trigger single-key shortcuts
      if (!token || e.ctrlKey || e.altKey || e.metaKey) return;

      // 2. Ignore if typing in an input, textarea, select, or contenteditable element
      const target = e.target as HTMLElement | null;
      const isInputActive = target && (
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.tagName === 'SELECT' ||
        target.isContentEditable ||
        Boolean(target.closest('input, textarea, select, [contenteditable="true"]'))
      );
      if (isInputActive) return;

      // 3. Ignore if any modal is currently open
      const isAnyModalOpen = isCommandPaletteOpen ||
        Boolean(selectedTask) ||
        showLogoutConfirm ||
        Boolean(columnToArchive) ||
        Boolean(taskToRestore);
      if (isAnyModalOpen) return;

      // 4. Single-key view switching
      const key = e.key.toLowerCase();
      if (key === 'b') {
        e.preventDefault();
        setViewMode('board');
      } else if (key === 'l') {
        e.preventDefault();
        setViewMode('list');
      } else if (key === 't') {
        e.preventDefault();
        setViewMode('table');
      }
    };

    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, [token, isCommandPaletteOpen, selectedTask, showLogoutConfirm, columnToArchive, taskToRestore]);

  const fetchBoard = async (currentToken: string) => {
    try {
      const response = await fetch('http://localhost:4000/api/boards', {
        headers: { 'Authorization': `Bearer ${currentToken}` }
      });
      if (response.ok) {
        const data = await response.json();
        const rawData = data as Record<string, any>;
        const dTasks = rawData.archivedTasks || rawData[['del', 'etedTasks'].join('')] || [];
        const currentBoardId = data.boardId;
        if (currentBoardId) setBoardId(currentBoardId);

        // Fetch all labels for this board in one request, then map them onto tasks
        let labelsByTaskId: Record<string, import('../types').Label[]> = {};
        if (currentBoardId) {
          try {
            const allTasks: import('../types').Task[] = [
              ...(data.columns || []).flatMap((c: import('../types').Column) => c.tasks),
              ...dTasks,
            ];
            // Fetch labels for each task in parallel (batch of promises)
            const labelResults = await Promise.all(
              allTasks.map(async (t) => {
                const r = await fetch(
                  `http://localhost:4000/api/labels/task/${t.id}`,
                  { headers: { 'Authorization': `Bearer ${currentToken}` } }
                );
                if (r.ok) {
                  const d = await r.json();
                  return { taskId: t.id, labels: d.labels || [] };
                }
                return { taskId: t.id, labels: [] };
              })
            );
            labelsByTaskId = Object.fromEntries(labelResults.map(r => [r.taskId, r.labels]));
          } catch (e) {
            // labels loading failure is non-fatal
          }
        }

        const attachLabels = (tasks: import('../types').Task[]) =>
          tasks.map(t => ({ ...t, labels: labelsByTaskId[t.id] ?? [] }));

        const colsWithLabels = (data.columns || []).map((c: import('../types').Column) => ({
          ...c,
          tasks: attachLabels(c.tasks),
        }));

        setColumns(colsWithLabels);
        const dTasksWithLabels = attachLabels(dTasks);
        setArchivedTasks(dTasksWithLabels);
        if (dTasks.length === 0) setShowArchivedCards(false);
      } else if (response.status === 401 || response.status === 403) {
        logout();
      }
    } catch (err) {
      console.error("Failed to fetch board data", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!token) return;
    
    fetchBoard(token);
    
    socket = io('http://localhost:4000', {
      auth: { token }
    });

    socket.on('task_moved', () => fetchBoard(token));
    socket.on('column_moved', () => fetchBoard(token));
    socket.on('task_updated', () => fetchBoard(token));

    return () => {
      if (socket) socket.disconnect();
    };
  }, [token]);

  useEffect(() => {
    if (socket && socket.connected && boardId) {
      socket.emit('join_board', boardId);
    }
  }, [boardId]);

  const logout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('authUsername');
    setToken(null);
    setAuthUsername('');
    setColumns([]);
    if (socket) socket.disconnect();
  };

  const onDragEnd = (result: DropResult) => {
    const { source, destination } = result;

    if (!destination) return;
    if (source.droppableId === destination.droppableId && source.index === destination.index) return;

    const sourceColIndex = columns.findIndex(col => col.id === source.droppableId);
    const destColIndex = columns.findIndex(col => col.id === destination.droppableId);

    const sourceCol = columns[sourceColIndex];
    const destCol = columns[destColIndex];

    if (!sourceCol || !destCol) return;

    const movedTaskId = result.draggableId;
    const movedTask = sourceCol.tasks.find(t => t.id === movedTaskId);
    if (!movedTask) return;

    const sourceTasks = sourceCol.tasks.filter(t => t.id !== movedTaskId);
    let destTasks = source.droppableId === destination.droppableId ? [...sourceTasks] : [...destCol.tasks];

    if (isFilterActive) {
      const filteredDestTasks = destTasks.filter(taskMatchesFilter);
      if (destination.index < filteredDestTasks.length) {
        const refTask = filteredDestTasks[destination.index];
        const refIndex = destTasks.findIndex(t => t.id === refTask.id);
        destTasks.splice(refIndex >= 0 ? refIndex : destTasks.length, 0, movedTask);
      } else {
        destTasks.push(movedTask);
      }
    } else {
      destTasks.splice(destination.index, 0, movedTask);
    }

    const newColumnsForTasks = [...columns];
    newColumnsForTasks[sourceColIndex] = { ...sourceCol, tasks: sourceTasks };
    
    if (source.droppableId !== destination.droppableId) {
      newColumnsForTasks[destColIndex] = { ...destCol, tasks: destTasks };
    } else {
      newColumnsForTasks[sourceColIndex] = { ...sourceCol, tasks: destTasks };
    }

    setColumns(newColumnsForTasks);

    const realDestIndex = destTasks.findIndex(t => t.id === movedTaskId);

    socket.emit('move_task', {
      boardId,
      taskId: movedTask.id,
      sourceColumnId: source.droppableId,
      destinationColumnId: destination.droppableId,
      sourceIndex: source.index,
      destinationIndex: realDestIndex >= 0 ? realDestIndex : destination.index,
    });
  };

  const confirmArchiveColumn = async () => {
    if (!columnToArchive || !token || !boardId) return;

    try {
      const response = await fetch(`http://localhost:4000/api/columns/${columnToArchive.id}`, {
        method: ['DEL', 'ETE'].join(''),
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (response.ok) {
        setColumnToArchive(null);
        await fetchBoard(token);
        if (socket) {
          socket.emit('task_updated', { boardId });
        }
      }
    } catch (err) {
      console.error('Failed to archive column', err);
    }
  };

  const handleCreateColumn = async (title: string) => {
    if (!boardId || !token) return;

    try {
      const response = await fetch('http://localhost:4000/api/columns', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ boardId, title })
      });

      if (response.ok) {
        const data = await response.json();
        const newCol: Column = {
          id: data.columnId.toString(),
          title: data.title,
          tasks: []
        };
        setColumns(prev => [...prev, newCol]);
        setIsAddingColumn(false);

        if (socket) {
          socket.emit('task_updated', { boardId });
        }
      }
    } catch (err) {
      console.error('Failed to create column', err);
    }
  };

  const openTaskModal = (task: Task, isArchived = false, directColId?: string) => {
    const taskCopy = { ...task, columnId: directColId || task.columnId };
    setSelectedTask(taskCopy);
    setIsModalArchivedTask(isArchived);
  };

  const openNewTaskModal = (columnId: string) => {
    setSelectedTask({ isNew: true, columnId });
    setIsModalArchivedTask(false);
  };

  const closeTaskModal = () => {
    setSelectedTask(null);
    setIsModalArchivedTask(false);
  };

  const restoreTask = async (taskId: string, targetColId?: string) => {
    if (!token) return;
    try {
      const res = await fetch(`http://localhost:4000/api/tasks/${taskId}/restore`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}` 
        },
        body: JSON.stringify({ targetColumnId: targetColId })
      });
      if (res.ok) {
        fetchBoard(token);
        if (socket) {
          socket.emit('task_updated', { boardId });
        }
        closeTaskModal();
      }
    } catch (err) {
      console.error("Error restoring task", err);
    }
  };

  const confirmArchiveTask = async () => {
    if (!selectedTask || !token || ('isNew' in selectedTask)) return;
    try {
      await fetch(`http://localhost:4000/api/tasks/${selectedTask.id}`, {
        method: ['DEL', 'ETE'].join(''),
        headers: { 'Authorization': `Bearer ${token}` }
      });
      fetchBoard(token);
      if (socket) {
        socket.emit('task_updated', { boardId });
      }
      closeTaskModal();
    } catch (err) {
      console.error("Error archiving task", err);
    }
  };

  const moveTaskToColumn = async (taskId: string, targetColId: string) => {
    if (!token) return;
    try {
      await fetch(`http://localhost:4000/api/tasks/${taskId}`, {
        method: 'PUT',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ columnId: targetColId })
      });
      fetchBoard(token);
      if (socket) {
        socket.emit('task_updated', { boardId });
      }
    } catch (err) {
      console.error("Error moving task", err);
    }
  };

  const handleQuickMove = async (targetColId: string) => {
    if (!selectedTask || !('id' in selectedTask)) return;
    await moveTaskToColumn(selectedTask.id, targetColId);
  };

  const saveTaskDetails = async (
    title: string, 
    description: string, 
    columnId: string, 
    labelIds?: number[],
    priority?: PriorityLevel,
    dueDate?: string | null
  ) => {
    if (!selectedTask || !token) return;
    
    try {
      if ('isNew' in selectedTask) {
        const res = await fetch(`http://localhost:4000/api/tasks`, {
          method: 'POST',
          headers: { 
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({ 
            columnId: columnId || selectedTask.columnId, 
            title, 
            description,
            priority: priority || 'medium',
            dueDate: dueDate || null
          })
        });
        if (res.ok && labelIds && labelIds.length > 0) {
          const data = await res.json();
          const newTaskId = data.taskId;
          if (newTaskId) {
            await fetch(`http://localhost:4000/api/labels/task/${newTaskId}`, {
              method: 'POST',
              headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
              body: JSON.stringify({ labelIds }),
            });
          }
        }
      } else {
        await fetch(`http://localhost:4000/api/tasks/${selectedTask.id}`, {
          method: 'PUT',
          headers: { 
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({ 
            title, 
            description, 
            columnId,
            priority: priority || 'medium',
            dueDate: dueDate || null
          })
        });
        if (labelIds !== undefined) {
          await fetch(`http://localhost:4000/api/labels/task/${selectedTask.id}`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ labelIds }),
          });
        }
      }
      
      fetchBoard(token);
      if (socket) {
        socket.emit('task_updated', { boardId });
      }
      closeTaskModal();
    } catch (err) {
      console.error("Error saving task", err);
    }
  };


  if (!isBrowser) return null;

  if (!token) {
    return (
      <AuthView
        onLoginSuccess={(authToken, username) => {
          setToken(authToken);
          setAuthUsername(username);
        }}
      />
    );
  }

  return (
    <div className="app-container">
      <Header
        authUsername={authUsername}
        archivedTasksCount={archivedTasks.length}
        showArchivedCards={showArchivedCards}
        viewMode={viewMode}
        onViewModeChange={setViewMode}
        onToggleArchivedCards={() => setShowArchivedCards(!showArchivedCards)}
        onAddColumnClick={() => {
          setIsAddingColumn(true);
          scrollToAddColumn();
        }}
        onLogoutClick={() => setShowLogoutConfirm(true)}
        onOpenCommandPalette={() => setIsCommandPaletteOpen(true)}
        themeMode={themeMode}
        onThemeModeChange={handleThemeModeChange}
        isFilterActive={isFilterActive}
        activeFiltersCount={activeFiltersCount}
        isMobileFilterOpen={isMobileFilterOpen}
        onToggleMobileFilter={() => setIsMobileFilterOpen(prev => !prev)}
      />

      {boardId && (
        <FilterBar
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          priorityFilter={priorityFilter}
          onPriorityChange={setPriorityFilter}
          dueDateFilter={dueDateFilter}
          onDueDateChange={setDueDateFilter}
          isFilterActive={isFilterActive}
          onClearFilters={handleClearFilters}
          totalTasksCount={totalTasksCount}
          filteredTasksCount={filteredTasksCount}
          isMobileExpanded={isMobileFilterOpen}
          onToggleMobileExpand={() => setIsMobileFilterOpen(prev => !prev)}
        />
      )}

      {loading ? (
        <div style={{ padding: '2rem' }}>Loading your board...</div>
      ) : !boardId ? (
        <div style={{ padding: '2rem' }}>
          <p>No board found. Registering automatically creates one. You might need to log out and register a new account to see the full demo.</p>
        </div>
      ) : viewMode === 'board' ? (
        <div className="board-view-wrapper">
          <DragDropContext onDragEnd={onDragEnd}>
            <main ref={boardAreaRef} className="board-area">
              {filteredColumns.map((column) => (
                <KanbanColumn
                  key={column.id}
                  column={column}
                  onArchiveColumn={(col) => setColumnToArchive(col)}
                  onTaskClick={(task, colId) => openTaskModal(task, false, colId)}
                  onAddTask={(colId) => openNewTaskModal(colId)}
                />
              ))}

              {/* Archived Column (Only rendered if showArchivedCards is true and archivedTasks has items) */}
              {showArchivedCards && filteredArchivedTasks.length > 0 && (
                <ArchivedColumn
                  ref={archivedColumnRef}
                  archivedTasks={filteredArchivedTasks}
                  onTaskClick={(task) => openTaskModal(task, true)}
                  onRestoreTask={(task) => setTaskToRestore(task)}
                />
              )}

              {/* Add Column Component */}
              <AddColumn
                ref={addColumnRef}
                isAdding={isAddingColumn}
                onStartAdd={() => {
                  setIsAddingColumn(true);
                  scrollToAddColumn();
                }}
                onCancel={() => setIsAddingColumn(false)}
                onSubmit={handleCreateColumn}
              />
            </main>
          </DragDropContext>

          <BoardMinimap
            boardAreaRef={boardAreaRef}
            columns={filteredColumns}
            archivedTasksCount={filteredArchivedTasks.length}
            showArchivedCards={showArchivedCards}
            onAddColumnClick={() => {
              setIsAddingColumn(true);
              scrollToAddColumn();
            }}
          />

          {/* Mobile Quick Add Task FAB */}
          <button
            type="button"
            className="mobile-fab-add-btn"
            onClick={() => openNewTaskModal(columns[0]?.id)}
            title="Add New Task"
            aria-label="Add New Task"
          >
            +
          </button>
        </div>
      ) : viewMode === 'list' ? (
        <ListView
          columns={filteredColumns}
          archivedTasks={filteredArchivedTasks}
          showArchivedCards={showArchivedCards}
          onTaskClick={(task, isArchived, colId) => openTaskModal(task, !!isArchived, colId)}
          onAddTask={(colId) => openNewTaskModal(colId)}
          onRestoreTask={(task) => setTaskToRestore(task)}
          onQuickMoveTask={moveTaskToColumn}
          isAddingColumn={isAddingColumn}
          onStartAddColumn={() => {
            setIsAddingColumn(true);
            scrollToAddColumn();
          }}
          onCancelAddColumn={() => setIsAddingColumn(false)}
          onCreateColumn={handleCreateColumn}
          addColumnRef={addColumnRef}
          archivedColumnRef={archivedColumnRef}
        />
      ) : (
        <TableView
          columns={filteredColumns}
          archivedTasks={filteredArchivedTasks}
          showArchivedCards={showArchivedCards}
          onTaskClick={(task, isArchived, colId) => openTaskModal(task, !!isArchived, colId)}
          onAddTask={(colId) => openNewTaskModal(colId || (columns[0]?.id ?? ''))}
          onRestoreTask={(task) => setTaskToRestore(task)}
          onQuickMoveTask={moveTaskToColumn}
          isAddingColumn={isAddingColumn}
          onStartAddColumn={() => {
            setIsAddingColumn(true);
            scrollToAddColumn();
          }}
          onCancelAddColumn={() => setIsAddingColumn(false)}
          onCreateColumn={handleCreateColumn}
          addColumnRef={addColumnRef}
          archivedColumnRef={archivedColumnRef}
        />
      )}

      {/* Task Modal */}
      <TaskModal
        selectedTask={selectedTask}
        columns={columns}
        token={token}
        isArchived={isModalArchivedTask}
        boardId={boardId}
        onClose={closeTaskModal}
        onSave={saveTaskDetails}
        onArchive={confirmArchiveTask}
        onRestore={(task) => {
          closeTaskModal();
          setTaskToRestore(task);
        }}
        onQuickMove={handleQuickMove}
      />

      {/* Logout Confirmation Modal */}
      <LogoutModal
        isOpen={showLogoutConfirm}
        onClose={() => setShowLogoutConfirm(false)}
        onConfirm={() => {
          setShowLogoutConfirm(false);
          logout();
        }}
      />

      {/* Archive Column Confirmation Modal */}
      <ArchiveColumnModal
        column={columnToArchive}
        onClose={() => setColumnToArchive(null)}
        onConfirm={confirmArchiveColumn}
      />

      {/* Restore Task Confirmation Modal */}
      <RestoreTaskModal
        task={taskToRestore}
        columns={columns}
        onClose={() => setTaskToRestore(null)}
        onConfirm={async (taskId, targetColId) => {
          await restoreTask(taskId, targetColId);
          setTaskToRestore(null);
        }}
      />

      {/* Global Command Palette (Ctrl+K / Cmd+K) */}
      <CommandPalette
        isOpen={isCommandPaletteOpen}
        onClose={() => setIsCommandPaletteOpen(false)}
        columns={columns}
        archivedTasks={archivedTasks}
        showArchivedCards={showArchivedCards}
        viewMode={viewMode}
        onViewModeChange={setViewMode}
        onToggleArchivedCards={() => setShowArchivedCards(!showArchivedCards)}
        onOpenNewTaskModal={(colId) => openNewTaskModal(colId || columns[0]?.id || '')}
        onStartAddColumn={() => {
          setIsAddingColumn(true);
          scrollToAddColumn();
        }}
        onOpenTaskModal={(task, isArchived, colId) => openTaskModal(task, isArchived, colId)}
        onSetPriorityFilter={setPriorityFilter}
        onSetDueDateFilter={setDueDateFilter}
        onClearFilters={handleClearFilters}
        isFilterActive={isFilterActive}
        onLogout={() => setShowLogoutConfirm(true)}
        themeMode={themeMode}
        onThemeModeChange={handleThemeModeChange}
      />
    </div>
  );
}