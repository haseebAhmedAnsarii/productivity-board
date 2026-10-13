"use client";

import React, { useState, useEffect } from 'react';
import { DragDropContext, Droppable, Draggable, DropResult } from '@hello-pangea/dnd';
import { io, Socket } from 'socket.io-client';

interface Task {
  id: string;
  title: string;
  description: string;
  originalColumnId?: string | null;
}

interface HistoryItem {
  id: number;
  task_id: number;
  user_id: number;
  username: string;
  change_type: string;
  old_value: string | null;
  new_value: string | null;
  created_at: string;
}

interface Column {
  id: string;
  title: string;
  tasks: Task[];
}

let socket: Socket;

export default function Home() {
  const [columns, setColumns] = useState<Column[]>([]);
  const [boardId, setBoardId] = useState('');
  const [isBrowser, setIsBrowser] = useState(false);
  const [loading, setLoading] = useState(true);
  
  const [token, setToken] = useState<string | null>(null);
  const [authUsername, setAuthUsername] = useState('');
  const [authPassword, setAuthPassword] = useState('');
  const [isLoginMode, setIsLoginMode] = useState(true);
  const [authError, setAuthError] = useState('');
  
  const [selectedTask, setSelectedTask] = useState<Task | { isNew: true, columnId: string } | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [columnToDelete, setColumnToDelete] = useState<Column | null>(null);
  const [deletedTasks, setDeletedTasks] = useState<Task[]>([]);
  const [showDeletedCards, setShowDeletedCards] = useState(false);
  const [isModalDeletedTask, setIsModalDeletedTask] = useState(false);
  const [taskHistory, setTaskHistory] = useState<HistoryItem[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [titleError, setTitleError] = useState(false);
  const [isAddingColumn, setIsAddingColumn] = useState(false);
  const [newColumnTitle, setNewColumnTitle] = useState('');
  const [columnTitleError, setColumnTitleError] = useState(false);

  useEffect(() => {
    setIsBrowser(true);
    const storedToken = localStorage.getItem('token');
    if (storedToken) setToken(storedToken);
  }, []);

  const fetchBoard = async (currentToken: string) => {
    try {
      const response = await fetch('http://localhost:4000/api/boards', {
        headers: { 'Authorization': `Bearer ${currentToken}` }
      });
      if (response.ok) {
        const data = await response.json();
        setColumns(data.columns || []);
        const dTasks = data.deletedTasks || [];
        setDeletedTasks(dTasks);
        if (dTasks.length === 0) setShowDeletedCards(false);
        if (data.boardId) setBoardId(data.boardId);
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

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError('');
    
    const endpoint = isLoginMode ? '/api/auth/login' : '/api/auth/register';
    try {
      const response = await fetch(`http://localhost:4000${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: authUsername, password: authPassword })
      });
      
      const data = await response.json();
      if (!response.ok) {
        setAuthError(data.error);
        return;
      }
      
      if (!isLoginMode) {
        setIsLoginMode(true);
        setAuthError('Registration successful. Please login.');
        return;
      }
      
      localStorage.setItem('token', data.token);
      setToken(data.token);
    } catch (err) {
      setAuthError('Failed to connect to server');
    }
  };

  const logout = () => {
    localStorage.removeItem('token');
    setToken(null);
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

    const sourceTasks = [...sourceCol.tasks];
    const destTasks = source.droppableId === destination.droppableId ? sourceTasks : [...destCol.tasks];

    const [movedTask] = sourceTasks.splice(source.index, 1);
    destTasks.splice(destination.index, 0, movedTask);

    const newColumnsForTasks = [...columns];
    newColumnsForTasks[sourceColIndex] = { ...sourceCol, tasks: sourceTasks };
    
    if (source.droppableId !== destination.droppableId) {
      newColumnsForTasks[destColIndex] = { ...destCol, tasks: destTasks };
    }

    setColumns(newColumnsForTasks);

    socket.emit('move_task', {
      boardId,
      taskId: movedTask.id,
      sourceColumnId: source.droppableId,
      destinationColumnId: destination.droppableId,
      sourceIndex: source.index,
      destinationIndex: destination.index,
    });
  };

  const confirmDeleteColumn = async () => {
    if (!columnToDelete || !token || !boardId) return;

    try {
      const response = await fetch(`http://localhost:4000/api/columns/${columnToDelete.id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (response.ok) {
        setColumns(prev => prev.filter(c => c.id !== columnToDelete.id));
        setColumnToDelete(null);
        if (socket) {
          socket.emit('task_updated', { boardId });
        }
      }
    } catch (err) {
      console.error('Failed to delete column', err);
    }
  };

  const handleCreateColumn = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!newColumnTitle.trim()) {
      setColumnTitleError(true);
      return;
    }
    if (!boardId || !token) return;

    try {
      const response = await fetch('http://localhost:4000/api/columns', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ boardId, title: newColumnTitle.trim() })
      });

      if (response.ok) {
        const data = await response.json();
        const newCol: Column = {
          id: data.columnId.toString(),
          title: data.title,
          tasks: []
        };
        setColumns(prev => [...prev, newCol]);
        setNewColumnTitle('');
        setIsAddingColumn(false);
        setColumnTitleError(false);

        if (socket) {
          socket.emit('task_updated', { boardId });
        }
      }
    } catch (err) {
      console.error('Failed to create column', err);
    }
  };

  const fetchTaskHistory = async (taskId: string) => {
    if (!token) return;
    setLoadingHistory(true);
    try {
      const res = await fetch(`http://localhost:4000/api/tasks/${taskId}/history`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setTaskHistory(data.history || []);
      }
    } catch (err) {
      console.error("Failed to load task history", err);
    } finally {
      setLoadingHistory(false);
    }
  };

  const formatHistoryTime = (dateStr: string) => {
    try {
      const d = new Date(dateStr);
      return d.toLocaleDateString(undefined, { 
        month: 'short', 
        day: 'numeric', 
        hour: '2-digit', 
        minute: '2-digit' 
      });
    } catch {
      return dateStr;
    }
  };

  const renderHistoryDescription = (item: HistoryItem) => {
    switch (item.change_type) {
      case 'created':
        return `Created this card: "${item.new_value}"`;
      case 'title':
        return (
          <span>
            Renamed title from <span style={{ textDecoration: 'line-through', opacity: 0.7 }}>&ldquo;{item.old_value}&rdquo;</span> to <strong style={{ color: 'var(--text-main)' }}>&ldquo;{item.new_value}&rdquo;</strong>
          </span>
        );
      case 'description':
        return 'Updated task description';
      case 'moved':
        return `Moved from "${item.old_value}" to "${item.new_value}"`;
      case 'deleted':
        return 'Moved card to Deleted column';
      case 'restored':
        return 'Restored card back to active board';
      default:
        return item.new_value || item.change_type;
    }
  };

  const openTaskModal = (task: Task, isDeleted = false) => {
    setSelectedTask(task);
    setEditTitle(task.title);
    setEditDescription(task.description);
    setTitleError(false);
    setIsModalDeletedTask(isDeleted);
    setShowHistory(false);
    if ('id' in task && task.id) {
      fetchTaskHistory(task.id);
    } else {
      setTaskHistory([]);
    }
  };

  const openNewTaskModal = (columnId: string) => {
    setSelectedTask({ isNew: true, columnId });
    setEditTitle('');
    setEditDescription('');
    setTitleError(false);
    setIsModalDeletedTask(false);
    setTaskHistory([]);
    setShowHistory(false);
  };

  const closeTaskModal = () => {
    setSelectedTask(null);
    setShowDeleteConfirm(false);
    setTitleError(false);
    setIsModalDeletedTask(false);
    setTaskHistory([]);
    setShowHistory(false);
  };

  const handleDeleteClick = () => {
    setShowDeleteConfirm(true);
  };

  const restoreTask = async (taskId: string) => {
    if (!token) return;
    try {
      const res = await fetch(`http://localhost:4000/api/tasks/${taskId}/restore`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}` 
        }
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

  const confirmDeleteTask = async () => {
    if (!selectedTask || !token || ('isNew' in selectedTask)) return;
    try {
      await fetch(`http://localhost:4000/api/tasks/${selectedTask.id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      fetchBoard(token);
      socket.emit('task_updated', { boardId });
      closeTaskModal();
    } catch (err) {
      console.error("Error deleting task", err);
    }
  };

  const saveTaskDetails = async () => {
    if (!selectedTask || !token) return;
    
    if (!editTitle.trim()) {
      setTitleError(true);
      return;
    }
    
    try {
      if ('isNew' in selectedTask) {
        await fetch(`http://localhost:4000/api/tasks`, {
          method: 'POST',
          headers: { 
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({ columnId: selectedTask.columnId, title: editTitle, description: editDescription })
        });
      } else {
        await fetch(`http://localhost:4000/api/tasks/${selectedTask.id}`, {
          method: 'PUT',
          headers: { 
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({ title: editTitle, description: editDescription })
        });
      }
      
      fetchBoard(token); // Refetch to get new IDs or latest state
      socket.emit('task_updated', { boardId });
      closeTaskModal();
    } catch (err) {
      console.error("Error saving task", err);
    }
  };

  if (!isBrowser) return null;

  if (!token) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', background: 'var(--bg-canvas)' }}>
        <div style={{ background: 'var(--bg-column)', padding: '2.5rem', borderRadius: 'var(--radius-modal)', width: '380px', border: '1px solid var(--border-ui)', boxShadow: 'var(--shadow-modal)' }}>
          <h2 style={{ marginBottom: '1.5rem', textAlign: 'center', fontSize: '1.35rem', fontWeight: 700, fontFamily: 'var(--font-heading)', letterSpacing: '-0.02em', color: 'var(--text-main)', textTransform: 'uppercase' }}>
            {isLoginMode ? 'Welcome Back' : 'Create Account'}
          </h2>
          <form onSubmit={handleAuth} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            {authError && <p style={{ color: 'var(--danger)', fontSize: '0.85rem', textAlign: 'center' }}>{authError}</p>}
            <input 
              type="text" 
              placeholder="Username" 
              value={authUsername} 
              onChange={e => setAuthUsername(e.target.value)} 
              style={{ padding: '0.75rem', borderRadius: 'var(--radius-input)', border: '1px solid var(--border-ui)', background: 'var(--bg-input)', color: 'var(--text-main)', fontSize: '0.925rem', outline: 'none', fontFamily: 'var(--font-body)' }} 
            />
            <input 
              type="password" 
              placeholder="Password" 
              value={authPassword} 
              onChange={e => setAuthPassword(e.target.value)} 
              style={{ padding: '0.75rem', borderRadius: 'var(--radius-input)', border: '1px solid var(--border-ui)', background: 'var(--bg-input)', color: 'var(--text-main)', fontSize: '0.925rem', outline: 'none', fontFamily: 'var(--font-body)' }} 
            />
            <button type="submit" className="btn-primary" style={{ padding: '0.8rem', fontSize: '0.925rem' }}>
              {isLoginMode ? 'Login' : 'Sign Up'}
            </button>
          </form>
          <p style={{ marginTop: '1.5rem', textAlign: 'center', cursor: 'pointer', color: 'var(--text-muted)', fontSize: '0.875rem', transition: 'color 0.2s ease' }} onClick={() => setIsLoginMode(!isLoginMode)} onMouseOver={e => e.currentTarget.style.color = 'var(--text-main)'} onMouseOut={e => e.currentTarget.style.color = 'var(--text-muted)'}>
            {isLoginMode ? "Don't have an account? Register" : "Already have an account? Login"}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="app-container">
      <header className="header">
        <h1>Productivity Board</h1>
        <div className="user-profile">
          {deletedTasks.length > 0 && (
            <button 
              onClick={() => setShowDeletedCards(!showDeletedCards)}
              className={showDeletedCards ? "btn-secondary" : "btn-deleted-cta"}
              style={{ padding: '0.45rem 0.85rem', fontSize: '0.8rem' }}
            >
              {showDeletedCards ? (
                <>Hide Deleted Cards ({deletedTasks.length})</>
              ) : (
                <>Show Deleted Cards ({deletedTasks.length})</>
              )}
            </button>
          )}
          <button 
            className="btn-primary" 
            onClick={() => {
              setIsAddingColumn(true);
              setNewColumnTitle('');
              setColumnTitleError(false);
            }}
            style={{ padding: '0.45rem 0.85rem', fontSize: '0.8rem' }}
          >
            + Add Column
          </button>
          <button onClick={() => setShowLogoutConfirm(true)} className="logout-btn">
            Logout
          </button>
          <div className="user-avatar">
            {authUsername ? authUsername.charAt(0).toUpperCase() : 'U'}
          </div>
        </div>
      </header>

      {loading ? (
        <div style={{ padding: '2rem' }}>Loading your board...</div>
      ) : !boardId ? (
        <div style={{ padding: '2rem' }}>
          <p>No board found. Registering automatically creates one. You might need to log out and register a new account to see the full demo.</p>
        </div>
      ) : (
        <DragDropContext onDragEnd={onDragEnd}>
          <main className="board-area">
            {columns.map((column) => (
              <div key={column.id} className="kanban-column">
                <div className="column-header">
                  <span className="column-header-title">{column.title}</span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <span className="task-count">{column.tasks.length}</span>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setColumnToDelete(column);
                      }}
                      title="Delete column"
                      className="delete-col-btn"
                    >
                      &times;
                    </button>
                  </div>
                </div>
                
                <Droppable droppableId={column.id}>
                  {(provided, snapshot) => (
                    <div
                      className="task-list"
                      ref={provided.innerRef}
                      {...provided.droppableProps}
                      style={{
                        backgroundColor: snapshot.isDraggingOver ? 'var(--surface-hover)' : 'transparent',
                        transition: 'background-color 0.2s ease',
                      }}
                    >
                      {column.tasks.map((task, taskIndex) => (
                        <Draggable key={task.id} draggableId={task.id} index={taskIndex}>
                          {(provided, snapshot) => (
                            <div
                              className="task-card"
                              ref={provided.innerRef}
                              {...provided.draggableProps}
                              {...provided.dragHandleProps}
                              onClick={() => openTaskModal(task)}
                              style={{
                                ...provided.draggableProps.style,
                                opacity: snapshot.isDragging ? 0.9 : 1,
                                boxShadow: snapshot.isDragging ? 'var(--shadow-lg)' : 'var(--shadow-sm)',
                              }}
                            >
                              <div className="task-title">{task.title}</div>
                              <div className="task-desc">{task.description}</div>
                            </div>
                          )}
                        </Draggable>
                      ))}
                      {provided.placeholder}
                    </div>
                  )}
                </Droppable>
                <button 
                  onClick={() => openNewTaskModal(column.id)}
                  className="add-task-btn"
                >
                  + Add Task
                </button>
              </div>
            ))}
            {/* Deleted Column (Only rendered if showDeletedCards is true and deletedTasks has items) */}
            {showDeletedCards && deletedTasks.length > 0 && (
              <div className="kanban-column deleted-column">
                <div className="column-header">
                  <span className="column-header-title" style={{ color: 'var(--danger)' }}>
                    Deleted
                  </span>
                  <span className="task-count" style={{ borderColor: 'var(--danger-muted)', color: 'var(--danger)' }}>
                    {deletedTasks.length}
                  </span>
                </div>
                
                <div className="task-list">
                  {deletedTasks.map((task) => (
                    <div
                      key={task.id}
                      className="task-card task-card-deleted"
                      onClick={() => openTaskModal(task, true)}
                    >
                      <div className="task-title" style={{ textDecoration: 'line-through', opacity: 0.85 }}>
                        {task.title}
                      </div>
                      {task.description && (
                        <div className="task-desc">{task.description}</div>
                      )}
                      <div style={{ marginTop: '0.65rem', display: 'flex', justifyContent: 'flex-end' }}>
                        <button
                          className="btn-restore-mini"
                          onClick={(e) => {
                            e.stopPropagation();
                            restoreTask(task.id);
                          }}
                        >
                          Restore
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Add Column Component */}
            <div className="add-column-wrapper">
              {!isAddingColumn ? (
                <button 
                  className="add-column-btn" 
                  onClick={() => {
                    setIsAddingColumn(true);
                    setNewColumnTitle('');
                    setColumnTitleError(false);
                  }}
                >
                  <span style={{ fontSize: '1.25rem', lineHeight: 1 }}>+</span>
                  <span>Add another column</span>
                </button>
              ) : (
                <form className="add-column-card" onSubmit={handleCreateColumn}>
                  <input
                    type="text"
                    placeholder="Enter column title..."
                    value={newColumnTitle}
                    onChange={(e) => {
                      setNewColumnTitle(e.target.value);
                      if (columnTitleError) setColumnTitleError(false);
                    }}
                    autoFocus
                    style={columnTitleError ? { borderColor: 'var(--danger)' } : {}}
                  />
                  {columnTitleError && (
                    <span style={{ color: 'var(--danger)', fontSize: '0.75rem', fontWeight: 500 }}>
                      Column title is required
                    </span>
                  )}
                  <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                    <button type="submit" className="btn-primary" style={{ padding: '0.5rem 1rem', fontSize: '0.875rem' }}>
                      Add Column
                    </button>
                    <button 
                      type="button" 
                      onClick={() => {
                        setIsAddingColumn(false);
                        setColumnTitleError(false);
                      }}
                      style={{ 
                        background: 'transparent', 
                        border: 'none', 
                        color: 'var(--text-muted)', 
                        fontSize: '1.25rem', 
                        cursor: 'pointer',
                        padding: '0.25rem 0.5rem',
                        lineHeight: 1
                      }}
                      onMouseOver={e => e.currentTarget.style.color = 'var(--text-main)'}
                      onMouseOut={e => e.currentTarget.style.color = 'var(--text-muted)'}
                      title="Cancel"
                    >
                      ✕
                    </button>
                  </div>
                </form>
              )}
            </div>
          </main>
        </DragDropContext>
      )}

      {selectedTask && (
        <div className="modal-overlay" onClick={closeTaskModal}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>{isModalDeletedTask ? 'Deleted Task' : (('isNew' in selectedTask) ? 'New Task' : 'Edit Task')}</h2>
              <button className="close-btn" onClick={closeTaskModal}>&times;</button>
            </div>
            
            {showDeleteConfirm ? (
              <div style={{ textAlign: 'center', padding: '0.75rem 0' }}>
                <p style={{ marginBottom: '1.5rem', fontSize: '1.05rem', color: 'var(--text-main)' }}>Are you sure you want to delete this task? (It will be moved to the Deleted column).</p>
                <div style={{ display: 'flex', gap: '0.85rem', justifyContent: 'center' }}>
                  <button 
                    onClick={() => setShowDeleteConfirm(false)}
                    className="btn-secondary"
                  >
                    Cancel
                  </button>
                  <button 
                    onClick={confirmDeleteTask}
                    className="btn-danger"
                  >
                    Yes, Delete Task
                  </button>
                </div>
              </div>
            ) : (
              <>
                <div className="form-group">
                  <label style={{ display: 'flex', alignItems: 'center' }}>
                    Title 
                    {titleError && <span style={{ color: 'var(--danger)', marginLeft: '0.5rem', fontSize: '0.75rem', fontWeight: 600 }}>*Required</span>}
                  </label>
                  <input 
                    type="text" 
                    value={editTitle} 
                    readOnly={isModalDeletedTask}
                    onChange={(e) => {
                      if (!isModalDeletedTask) {
                        setEditTitle(e.target.value);
                        if (titleError) setTitleError(false);
                      }
                    }} 
                    autoFocus={!isModalDeletedTask}
                    style={titleError ? { borderColor: 'var(--danger)' } : (isModalDeletedTask ? { opacity: 0.8, cursor: 'not-allowed' } : {})}
                  />
                </div>
                
                <div className="form-group">
                  <label>Description</label>
                  <textarea 
                    rows={4} 
                    placeholder="Add a detailed description..." 
                    value={editDescription} 
                    readOnly={isModalDeletedTask}
                    onChange={(e) => {
                      if (!isModalDeletedTask) setEditDescription(e.target.value);
                    }}
                    style={isModalDeletedTask ? { opacity: 0.8, cursor: 'not-allowed' } : {}}
                  />
                </div>

                {!('isNew' in selectedTask) && (
                  <div className="task-history-section">
                    <div 
                      className="task-history-header"
                      onClick={() => setShowHistory(!showHistory)}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <span className="task-history-title">Activity & History</span>
                        {taskHistory.length > 0 && (
                          <span className="task-count" style={{ fontSize: '0.65rem', padding: '1px 5px' }}>
                            {taskHistory.length}
                          </span>
                        )}
                      </div>
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                        {showHistory ? '▲ Hide' : '▼ View History'}
                      </span>
                    </div>

                    {showHistory && (
                      <div className="task-history-timeline">
                        {loadingHistory ? (
                          <div style={{ color: 'var(--text-muted)', fontSize: '0.8rem', padding: '0.5rem 0' }}>
                            Loading history...
                          </div>
                        ) : taskHistory.length === 0 ? (
                          <div style={{ color: 'var(--text-muted)', fontSize: '0.8rem', padding: '0.5rem 0', fontStyle: 'italic' }}>
                            No edit activity recorded yet.
                          </div>
                        ) : (
                          taskHistory.map((item) => (
                            <div key={item.id} className="history-item">
                              <div className="history-dot" />
                              <div className="history-meta">
                                <span className="history-user">@{item.username || 'user'}</span>
                                <span className="history-time">{formatHistoryTime(item.created_at)}</span>
                              </div>
                              <div className="history-desc">
                                {renderHistoryDescription(item)}
                              </div>
                            </div>
                          ))
                        )}
                      </div>
                    )}
                  </div>
                )}
                
                {isModalDeletedTask ? (
                  <div style={{ display: 'flex', gap: '0.85rem', marginTop: '0.5rem' }}>
                    <button className="btn-secondary" onClick={closeTaskModal} style={{ flex: 1 }}>
                      Close
                    </button>
                    <button 
                      className="btn-primary" 
                      onClick={() => {
                        if (selectedTask && 'id' in selectedTask) {
                          restoreTask(selectedTask.id);
                        }
                      }} 
                      style={{ flex: 1 }}
                    >
                      Restore Task
                    </button>
                  </div>
                ) : (
                  <div style={{ display: 'flex', gap: '0.85rem', marginTop: '0.5rem' }}>
                    <button className="btn-primary" onClick={saveTaskDetails} style={{ flex: 1 }}>
                      {('isNew' in selectedTask) ? 'Create Task' : 'Save Changes'}
                    </button>
                    {!("isNew" in selectedTask) && (
                      <button 
                        onClick={handleDeleteClick}
                        className="btn-danger-outline"
                      >
                        Delete
                      </button>
                    )}
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      )}
      {showLogoutConfirm && (
        <div className="modal-overlay" onClick={() => setShowLogoutConfirm(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '420px', textAlign: 'center' }}>
            <div className="modal-header" style={{ justifyContent: 'center', position: 'relative' }}>
              <h2>Confirm Logout</h2>
              <button 
                className="close-btn" 
                onClick={() => setShowLogoutConfirm(false)}
                style={{ position: 'absolute', right: 0, top: 0 }}
              >
                &times;
              </button>
            </div>
            
            <p style={{ color: 'var(--text-muted)', fontSize: '1rem', lineHeight: 1.5, margin: '0.5rem 0 1.25rem' }}>
              Are you sure you want to log out of your session?
            </p>

            <div style={{ display: 'flex', gap: '0.85rem', justifyContent: 'center' }}>
              <button 
                onClick={() => setShowLogoutConfirm(false)}
                className="btn-secondary"
                style={{ flex: 1 }}
              >
                Cancel
              </button>
              <button 
                onClick={() => {
                  setShowLogoutConfirm(false);
                  logout();
                }}
                className="btn-danger"
                style={{ flex: 1 }}
              >
                Log Out
              </button>
            </div>
          </div>
        </div>
      )}
      {columnToDelete && (
        <div className="modal-overlay" onClick={() => setColumnToDelete(null)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '440px', textAlign: 'center' }}>
            <div className="modal-header" style={{ justifyContent: 'center', position: 'relative' }}>
              <h2>Delete Column</h2>
              <button 
                className="close-btn" 
                onClick={() => setColumnToDelete(null)}
                style={{ position: 'absolute', right: 0, top: 0 }}
              >
                &times;
              </button>
            </div>
            
            <p style={{ color: 'var(--text-main)', fontSize: '1rem', lineHeight: 1.5, margin: '0.5rem 0' }}>
              Are you sure you want to delete <strong>&ldquo;{columnToDelete.title}&rdquo;</strong>?
            </p>
            {columnToDelete.tasks.length > 0 && (
              <p style={{ color: 'var(--danger)', fontSize: '0.875rem', marginBottom: '1.25rem' }}>
                Warning: All {columnToDelete.tasks.length} {columnToDelete.tasks.length === 1 ? 'task' : 'tasks'} inside this column will also be permanently deleted.
              </p>
            )}

            <div style={{ display: 'flex', gap: '0.85rem', justifyContent: 'center', marginTop: '1rem' }}>
              <button 
                onClick={() => setColumnToDelete(null)}
                className="btn-secondary"
                style={{ flex: 1 }}
              >
                Cancel
              </button>
              <button 
                onClick={confirmDeleteColumn}
                className="btn-danger"
                style={{ flex: 1 }}
              >
                Delete Column
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}