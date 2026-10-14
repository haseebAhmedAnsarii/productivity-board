import React, { useState, useMemo } from 'react';
import { Column, Task } from '../types';

interface TableViewProps {
  columns: Column[];
  deletedTasks: Task[];
  showDeletedCards: boolean;
  onTaskClick: (task: Task, isDeleted?: boolean, columnId?: string) => void;
  onAddTask: (columnId?: string) => void;
  onRestoreTask: (task: Task) => void;
  onQuickMoveTask: (taskId: string, targetColId: string) => Promise<void>;
}

export const TableView: React.FC<TableViewProps> = ({
  columns,
  deletedTasks,
  showDeletedCards,
  onTaskClick,
  onAddTask,
  onRestoreTask,
  onQuickMoveTask,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedColumnFilter, setSelectedColumnFilter] = useState('ALL');
  const [sortBy, setSortBy] = useState<'id' | 'title' | 'column'>('id');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');

  // Aggregate active tasks with column info
  const allActiveTasks = useMemo(() => {
    const list: Array<{ task: Task; column: Column }> = [];
    columns.forEach((col) => {
      col.tasks.forEach((t) => {
        list.push({ task: t, column: col });
      });
    });
    return list;
  }, [columns]);

  // Filter & sort active tasks
  const filteredActiveTasks = useMemo(() => {
    return allActiveTasks
      .filter(({ task, column }) => {
        const matchesSearch =
          task.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
          (task.description && task.description.toLowerCase().includes(searchTerm.toLowerCase()));
        const matchesColumn = selectedColumnFilter === 'ALL' || column.id === selectedColumnFilter;
        return matchesSearch && matchesColumn;
      })
      .sort((a, b) => {
        let comp = 0;
        if (sortBy === 'id') {
          comp = parseInt(a.task.id) - parseInt(b.task.id);
        } else if (sortBy === 'title') {
          comp = a.task.title.localeCompare(b.task.title);
        } else if (sortBy === 'column') {
          comp = a.column.title.localeCompare(b.column.title);
        }
        return sortOrder === 'asc' ? comp : -comp;
      });
  }, [allActiveTasks, searchTerm, selectedColumnFilter, sortBy, sortOrder]);

  // Filter deleted tasks
  const filteredDeletedTasks = useMemo(() => {
    if (!showDeletedCards) return [];
    return deletedTasks.filter((t) => {
      const matchesSearch =
        t.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (t.description && t.description.toLowerCase().includes(searchTerm.toLowerCase()));
      const matchesColumn =
        selectedColumnFilter === 'ALL' || selectedColumnFilter === 'DELETED';
      return matchesSearch && matchesColumn;
    });
  }, [deletedTasks, showDeletedCards, searchTerm, selectedColumnFilter]);

  const handleSort = (field: 'id' | 'title' | 'column') => {
    if (sortBy === field) {
      setSortOrder(prev => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortBy(field);
      setSortOrder('asc');
    }
  };

  const defaultColId = columns.length > 0 ? columns[0].id : '';

  return (
    <div className="table-view-container">
      {/* Top Filter & Search Toolbar */}
      <div className="table-toolbar">
        <div className="table-toolbar-left">
          <input
            type="text"
            className="table-search-input"
            placeholder="Search tasks by title or description..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
          <select
            className="table-filter-select"
            value={selectedColumnFilter}
            onChange={(e) => setSelectedColumnFilter(e.target.value)}
          >
            <option value="ALL">All Columns</option>
            {columns.map((c) => (
              <option key={c.id} value={c.id}>
                {c.title}
              </option>
            ))}
            {showDeletedCards && deletedTasks.length > 0 && (
              <option value="DELETED">Deleted Tasks</option>
            )}
          </select>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
            {filteredActiveTasks.length + filteredDeletedTasks.length} {filteredActiveTasks.length + filteredDeletedTasks.length === 1 ? 'task' : 'tasks'}
          </span>
          <button
            type="button"
            className="btn-primary"
            onClick={() => onAddTask(defaultColId)}
            style={{ padding: '0.45rem 0.85rem', fontSize: '0.8rem' }}
          >
            + Add Task
          </button>
        </div>
      </div>

      {/* Main Table */}
      <div className="table-card-container">
        <table className="kanban-table">
          <thead>
            <tr>
              <th 
                style={{ width: '80px', cursor: 'pointer' }}
                onClick={() => handleSort('id')}
                title="Click to sort by ID"
              >
                #ID {sortBy === 'id' ? (sortOrder === 'asc' ? '▲' : '▼') : ''}
              </th>
              <th 
                style={{ cursor: 'pointer' }}
                onClick={() => handleSort('title')}
                title="Click to sort by Title"
              >
                Title {sortBy === 'title' ? (sortOrder === 'asc' ? '▲' : '▼') : ''}
              </th>
              <th 
                style={{ width: '180px', cursor: 'pointer' }}
                onClick={() => handleSort('column')}
                title="Click to sort by Column"
              >
                Column {sortBy === 'column' ? (sortOrder === 'asc' ? '▲' : '▼') : ''}
              </th>
              <th>Description</th>
              <th style={{ width: '100px', textAlign: 'right' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredActiveTasks.length === 0 && filteredDeletedTasks.length === 0 ? (
              <tr>
                <td colSpan={5} style={{ textAlign: 'center', padding: '2.5rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>
                  No tasks found matching your filter criteria.
                </td>
              </tr>
            ) : (
              <>
                {/* Active Tasks */}
                {filteredActiveTasks.map(({ task, column }) => (
                  <tr
                    key={task.id}
                    onClick={() => onTaskClick(task, false, column.id)}
                    style={{ cursor: 'pointer' }}
                  >
                    <td>
                      <span className="task-badge">#{task.id}</span>
                    </td>
                    <td>
                      <span style={{ fontWeight: 600, color: 'var(--text-main)' }}>{task.title}</span>
                    </td>
                    <td onClick={(e) => e.stopPropagation()}>
                      <select
                        className="table-col-select"
                        value={column.id}
                        onChange={(e) => onQuickMoveTask(task.id, e.target.value)}
                        title="Change column"
                      >
                        {columns.map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.title}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td>
                      <span style={{ color: 'var(--text-muted)', fontSize: '0.825rem' }}>
                        {task.description ? task.description : <span style={{ opacity: 0.5 }}>—</span>}
                      </span>
                    </td>
                    <td style={{ textAlign: 'right' }} onClick={(e) => e.stopPropagation()}>
                      <button
                        type="button"
                        className="table-action-icon"
                        onClick={() => onTaskClick(task, false, column.id)}
                        title="Edit task"
                      >
                        ✎ Edit
                      </button>
                    </td>
                  </tr>
                ))}

                {/* Soft-Deleted Tasks */}
                {filteredDeletedTasks.map((task) => (
                  <tr
                    key={task.id}
                    className="table-row-deleted"
                    onClick={() => onTaskClick(task, true)}
                    style={{ cursor: 'pointer', background: 'rgba(239, 68, 68, 0.04)' }}
                  >
                    <td>
                      <span className="task-badge task-badge-deleted">#{task.id}</span>
                    </td>
                    <td>
                      <span style={{ textDecoration: 'line-through', color: 'var(--text-main)' }}>
                        {task.title}
                      </span>
                    </td>
                    <td>
                      <span style={{ color: 'var(--danger)', fontSize: '0.78rem', fontWeight: 600, textTransform: 'uppercase' }}>
                        Deleted
                      </span>
                    </td>
                    <td>
                      <span style={{ color: 'var(--text-muted)', fontSize: '0.825rem' }}>
                        {task.description ? task.description : <span style={{ opacity: 0.5 }}>—</span>}
                      </span>
                    </td>
                    <td style={{ textAlign: 'right' }} onClick={(e) => e.stopPropagation()}>
                      <button
                        type="button"
                        className="btn-restore-mini"
                        onClick={() => onRestoreTask(task)}
                      >
                        Restore
                      </button>
                    </td>
                  </tr>
                ))}
              </>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};
