"use client";

import React, { useState, useEffect } from 'react';
import { DragDropContext, Droppable, Draggable, DropResult } from '@hello-pangea/dnd';
import { io, Socket } from 'socket.io-client';

interface Task {
  id: string;
  title: string;
  description: string;
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

  const openTaskModal = (task: Task) => {
    setSelectedTask(task);
    setEditTitle(task.title);
    setEditDescription(task.description);
    setTitleError(false);
  };

  const openNewTaskModal = (columnId: string) => {
    setSelectedTask({ isNew: true, columnId });
    setEditTitle('');
    setEditDescription('');
    setTitleError(false);
  };

  const closeTaskModal = () => {
    setSelectedTask(null);
    setShowDeleteConfirm(false);
  };

  const handleDeleteClick = () => {
    setShowDeleteConfirm(true);
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
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', background: 'var(--background)' }}>
        <div style={{ background: 'var(--surface)', padding: '2.5rem', borderRadius: 'var(--radius-lg)', width: '380px', border: '1px solid var(--border)', boxShadow: 'var(--shadow-lg)' }}>
          <h2 style={{ marginBottom: '1.5rem', textAlign: 'center', fontSize: '1.5rem', fontWeight: 600 }}>{isLoginMode ? 'Welcome Back' : 'Create Account'}</h2>
          <form onSubmit={handleAuth} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            {authError && <p style={{ color: '#ef4444', fontSize: '0.875rem', textAlign: 'center' }}>{authError}</p>}
            <input 
              type="text" 
              placeholder="Username" 
              value={authUsername} 
              onChange={e => setAuthUsername(e.target.value)} 
              style={{ padding: '0.75rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)', background: 'var(--background)', color: 'white', fontSize: '1rem', outline: 'none' }} 
            />
            <input 
              type="password" 
              placeholder="Password" 
              value={authPassword} 
              onChange={e => setAuthPassword(e.target.value)} 
              style={{ padding: '0.75rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)', background: 'var(--background)', color: 'white', fontSize: '1rem', outline: 'none' }} 
            />
            <button type="submit" className="btn-primary" style={{ padding: '0.875rem', fontSize: '1rem' }}>{isLoginMode ? 'Login' : 'Sign Up'}</button>
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
        <div className="user-profile" style={{ display: 'flex', alignItems: 'center', gap: '1.25rem' }}>
          <button 
            className="btn-primary" 
            onClick={() => {
              setIsAddingColumn(true);
              setNewColumnTitle('');
              setColumnTitleError(false);
            }}
            style={{ padding: '0.45rem 0.9rem', fontSize: '0.85rem' }}
          >
            + Add Column
          </button>
          <button onClick={() => setShowLogoutConfirm(true)} style={{ background: 'transparent', color: 'var(--text-muted)', border: 'none', cursor: 'pointer', fontSize: '0.875rem', transition: 'color 0.2s ease' }} onMouseOver={e => e.currentTarget.style.color = 'var(--text-main)'} onMouseOut={e => e.currentTarget.style.color = 'var(--text-muted)'}>Logout</button>
          <div style={{ width: '36px', height: '36px', borderRadius: '50%', background: 'linear-gradient(90deg, rgba(45, 212, 191, 1) 50%, rgba(38, 222, 90, 1) 100%)' }}></div>
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
                  <span>{column.title}</span>
                  <span className="task-count">{column.tasks.length}</span>
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
                  style={{ margin: '0 1.25rem 1.25rem', padding: '0.75rem', background: 'transparent', border: '1px dashed var(--border)', color: 'var(--text-muted)', borderRadius: 'var(--radius-md)', cursor: 'pointer', transition: 'var(--transition)', textAlign: 'left', fontWeight: 500 }}
                  onMouseOver={e => { e.currentTarget.style.color = 'var(--text-main)'; e.currentTarget.style.borderColor = 'var(--text-muted)'; }}
                  onMouseOut={e => { e.currentTarget.style.color = 'var(--text-muted)'; e.currentTarget.style.borderColor = 'var(--border)'; }}
                >
                  + Add Task
                </button>
              </div>
            ))}
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
                    style={columnTitleError ? { borderColor: '#ef4444' } : {}}
                  />
                  {columnTitleError && (
                    <span style={{ color: '#ef4444', fontSize: '0.75rem', fontWeight: 500 }}>
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
              <h2>Edit Task</h2>
              <button className="close-btn" onClick={closeTaskModal}>&times;</button>
            </div>
            
            {showDeleteConfirm ? (
              <div style={{ textAlign: 'center', padding: '1rem 0' }}>
                <p style={{ marginBottom: '1.5rem', fontSize: '1.1rem', color: 'var(--text-main)' }}>Are you sure you want to permanently delete this task?</p>
                <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center' }}>
                  <button 
                    onClick={() => setShowDeleteConfirm(false)}
                    style={{ background: 'var(--surface-hover)', border: '1px solid var(--border)', color: 'var(--text-main)', padding: '0.75rem 1.5rem', borderRadius: 'var(--radius-md)', cursor: 'pointer', transition: 'var(--transition)' }}
                    onMouseOver={e => e.currentTarget.style.background = 'var(--surface)'}
                    onMouseOut={e => e.currentTarget.style.background = 'var(--surface-hover)'}
                  >
                    Cancel
                  </button>
                  <button 
                    onClick={confirmDeleteTask}
                    style={{ background: '#ef4444', border: 'none', color: 'white', padding: '0.75rem 1.5rem', borderRadius: 'var(--radius-md)', cursor: 'pointer', fontWeight: 500, transition: 'var(--transition)' }}
                    onMouseOver={e => e.currentTarget.style.background = '#dc2626'}
                    onMouseOut={e => e.currentTarget.style.background = '#ef4444'}
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
                    {titleError && <span style={{ color: '#ef4444', marginLeft: '0.5rem', fontSize: '0.75rem', fontWeight: 600 }}>*Required</span>}
                  </label>
                  <input 
                    type="text" 
                    value={editTitle} 
                    onChange={(e) => {
                      setEditTitle(e.target.value);
                      if (titleError) setTitleError(false);
                    }} 
                    autoFocus 
                    style={titleError ? { borderColor: '#ef4444' } : {}}
                  />
                </div>
                
                <div className="form-group">
                  <label>Description</label>
                  <textarea 
                    rows={4} 
                    placeholder="Add a detailed description..." 
                    value={editDescription} 
                    onChange={(e) => setEditDescription(e.target.value)}
                  />
                </div>
                
                <div style={{ display: 'flex', gap: '1rem', marginTop: '0.5rem' }}>
                  <button className="btn-primary" onClick={saveTaskDetails} style={{ flex: 1 }}>
                    {('isNew' in selectedTask) ? 'Create Task' : 'Save Changes'}
                  </button>
                  {!("isNew" in selectedTask) && (
                    <button 
                      onClick={handleDeleteClick}
                      style={{ background: 'transparent', border: '1px solid #ef4444', color: '#ef4444', padding: '0.75rem 1.5rem', borderRadius: 'var(--radius-md)', cursor: 'pointer', transition: 'var(--transition)', fontWeight: 500 }}
                      onMouseOver={e => { e.currentTarget.style.background = '#ef4444'; e.currentTarget.style.color = 'white'; }}
                      onMouseOut={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = '#ef4444'; }}
                    >
                      Delete
                    </button>
                  )}
                </div>
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

            <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center' }}>
              <button 
                onClick={() => setShowLogoutConfirm(false)}
                style={{ 
                  flex: 1,
                  background: 'var(--surface-hover)', 
                  border: '1px solid var(--border)', 
                  color: 'var(--text-main)', 
                  padding: '0.75rem 1.25rem', 
                  borderRadius: 'var(--radius-md)', 
                  cursor: 'pointer', 
                  transition: 'var(--transition)',
                  fontWeight: 500
                }}
                onMouseOver={e => e.currentTarget.style.background = 'var(--surface)'}
                onMouseOut={e => e.currentTarget.style.background = 'var(--surface-hover)'}
              >
                Cancel
              </button>
              <button 
                onClick={() => {
                  setShowLogoutConfirm(false);
                  logout();
                }}
                style={{ 
                  flex: 1,
                  background: '#ef4444', 
                  border: 'none', 
                  color: 'white', 
                  padding: '0.75rem 1.25rem', 
                  borderRadius: 'var(--radius-md)', 
                  cursor: 'pointer', 
                  fontWeight: 600, 
                  transition: 'var(--transition)' 
                }}
                onMouseOver={e => e.currentTarget.style.background = '#dc2626'}
                onMouseOut={e => e.currentTarget.style.background = '#ef4444'}
              >
                Log Out
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}