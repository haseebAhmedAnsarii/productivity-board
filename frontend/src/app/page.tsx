"use client";

import React, { useState, useEffect, useRef } from 'react';
import { DragDropContext, DropResult } from '@hello-pangea/dnd';
import { io, Socket } from 'socket.io-client';

import { Column, SelectedTask, Task, ViewMode } from '../types';
import {
  Header,
  AuthView,
  KanbanColumn,
  DeletedColumn,
  AddColumn,
  TaskModal,
  DeleteColumnModal,
  LogoutModal,
  RestoreTaskModal,
  ListView,
  TableView,
} from '../components';

let socket: Socket;

export default function Home() {
  const [columns, setColumns] = useState<Column[]>([]);
  const [boardId, setBoardId] = useState('');
  const [isBrowser, setIsBrowser] = useState(false);
  const [loading, setLoading] = useState(true);
  
  const [token, setToken] = useState<string | null>(null);
  const [authUsername, setAuthUsername] = useState('');
  
  const [selectedTask, setSelectedTask] = useState<SelectedTask>(null);
  const [isModalDeletedTask, setIsModalDeletedTask] = useState(false);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [columnToDelete, setColumnToDelete] = useState<Column | null>(null);
  const [deletedTasks, setDeletedTasks] = useState<Task[]>([]);
  const [showDeletedCards, setShowDeletedCards] = useState(false);
  const [isAddingColumn, setIsAddingColumn] = useState(false);
  const [taskToRestore, setTaskToRestore] = useState<Task | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>('board');

  const deletedColumnRef = useRef<HTMLDivElement>(null);
  const addColumnRef = useRef<HTMLDivElement>(null);
  const boardAreaRef = useRef<HTMLElement>(null);

  const scrollToAddColumn = () => {
    setTimeout(() => {
      if (addColumnRef.current) {
        addColumnRef.current.scrollIntoView({
          behavior: 'smooth',
          inline: viewMode === 'board' ? 'end' : 'nearest',
          block: viewMode === 'board' ? 'nearest' : 'center',
        });
      } else if (boardAreaRef.current) {
        boardAreaRef.current.scrollTo({
          left: boardAreaRef.current.scrollWidth,
          behavior: 'smooth'
        });
      }
    }, 60);
  };

  useEffect(() => {
    if (showDeletedCards && deletedTasks.length > 0) {
      const timer = setTimeout(() => {
        if (viewMode === 'board' && boardAreaRef.current) {
          boardAreaRef.current.scrollTo({
            left: boardAreaRef.current.scrollWidth,
            behavior: 'smooth'
          });
        } else if (deletedColumnRef.current) {
          deletedColumnRef.current.scrollIntoView({
            behavior: 'smooth',
            inline: viewMode === 'board' ? 'end' : 'nearest',
            block: viewMode === 'board' ? 'nearest' : 'center'
          });
        }
      }, 80);
      return () => clearTimeout(timer);
    }
  }, [showDeletedCards, viewMode]);

  useEffect(() => {
    if (isAddingColumn) {
      const timer = setTimeout(scrollToAddColumn, 60);
      return () => clearTimeout(timer);
    }
  }, [isAddingColumn]);

  useEffect(() => {
    setIsBrowser(true);
    const storedToken = localStorage.getItem('token');
    const storedUser = localStorage.getItem('authUsername');
    if (storedToken) setToken(storedToken);
    if (storedUser) setAuthUsername(storedUser);
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
        setColumnToDelete(null);
        await fetchBoard(token);
        if (socket) {
          socket.emit('task_updated', { boardId });
        }
      }
    } catch (err) {
      console.error('Failed to delete column', err);
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

  const openTaskModal = (task: Task, isDeleted = false, directColId?: string) => {
    const taskCopy = { ...task, columnId: directColId || task.columnId };
    setSelectedTask(taskCopy);
    setIsModalDeletedTask(isDeleted);
  };

  const openNewTaskModal = (columnId: string) => {
    setSelectedTask({ isNew: true, columnId });
    setIsModalDeletedTask(false);
  };

  const closeTaskModal = () => {
    setSelectedTask(null);
    setIsModalDeletedTask(false);
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

  const confirmDeleteTask = async () => {
    if (!selectedTask || !token || ('isNew' in selectedTask)) return;
    try {
      await fetch(`http://localhost:4000/api/tasks/${selectedTask.id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      fetchBoard(token);
      if (socket) {
        socket.emit('task_updated', { boardId });
      }
      closeTaskModal();
    } catch (err) {
      console.error("Error deleting task", err);
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

  const saveTaskDetails = async (title: string, description: string, columnId: string) => {
    if (!selectedTask || !token) return;
    
    try {
      if ('isNew' in selectedTask) {
        await fetch(`http://localhost:4000/api/tasks`, {
          method: 'POST',
          headers: { 
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({ columnId: columnId || selectedTask.columnId, title, description })
        });
      } else {
        await fetch(`http://localhost:4000/api/tasks/${selectedTask.id}`, {
          method: 'PUT',
          headers: { 
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({ title, description, columnId })
        });
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
        deletedTasksCount={deletedTasks.length}
        showDeletedCards={showDeletedCards}
        viewMode={viewMode}
        onViewModeChange={setViewMode}
        onToggleDeletedCards={() => setShowDeletedCards(!showDeletedCards)}
        onAddColumnClick={() => {
          setIsAddingColumn(true);
          scrollToAddColumn();
        }}
        onLogoutClick={() => setShowLogoutConfirm(true)}
      />

      {loading ? (
        <div style={{ padding: '2rem' }}>Loading your board...</div>
      ) : !boardId ? (
        <div style={{ padding: '2rem' }}>
          <p>No board found. Registering automatically creates one. You might need to log out and register a new account to see the full demo.</p>
        </div>
      ) : viewMode === 'board' ? (
        <DragDropContext onDragEnd={onDragEnd}>
          <main ref={boardAreaRef} className="board-area">
            {columns.map((column) => (
              <KanbanColumn
                key={column.id}
                column={column}
                onDeleteColumn={(col) => setColumnToDelete(col)}
                onTaskClick={(task, colId) => openTaskModal(task, false, colId)}
                onAddTask={(colId) => openNewTaskModal(colId)}
              />
            ))}

            {/* Deleted Column (Only rendered if showDeletedCards is true and deletedTasks has items) */}
            {showDeletedCards && deletedTasks.length > 0 && (
              <DeletedColumn
                ref={deletedColumnRef}
                deletedTasks={deletedTasks}
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
      ) : viewMode === 'list' ? (
        <ListView
          columns={columns}
          deletedTasks={deletedTasks}
          showDeletedCards={showDeletedCards}
          onTaskClick={(task, isDeleted, colId) => openTaskModal(task, !!isDeleted, colId)}
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
          deletedColumnRef={deletedColumnRef}
        />
      ) : (
        <TableView
          columns={columns}
          deletedTasks={deletedTasks}
          showDeletedCards={showDeletedCards}
          onTaskClick={(task, isDeleted, colId) => openTaskModal(task, !!isDeleted, colId)}
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
        />
      )}

      {/* Task Modal */}
      <TaskModal
        selectedTask={selectedTask}
        columns={columns}
        token={token}
        isDeleted={isModalDeletedTask}
        onClose={closeTaskModal}
        onSave={saveTaskDetails}
        onDelete={confirmDeleteTask}
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

      {/* Delete Column Confirmation Modal */}
      <DeleteColumnModal
        column={columnToDelete}
        onClose={() => setColumnToDelete(null)}
        onConfirm={confirmDeleteColumn}
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
    </div>
  );
}