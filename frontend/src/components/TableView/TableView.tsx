import './TableView.scss';
import React, { useState, useMemo } from 'react';
import { Column, Task } from '../../types';
import { AddColumn } from '../AddColumn';
import { stripRichTextToSnippet } from '../RichTextRenderer';
import { PRIORITY_CONFIG, getDueDateInfo } from '../../utils/priorityDateUtils';
import { CustomSelect, SelectOption } from '../CustomSelect';

interface TableViewProps {
  columns: Column[];
  deletedTasks: Task[];
  showDeletedCards: boolean;
  onTaskClick: (task: Task, isDeleted?: boolean, columnId?: string) => void;
  onAddTask: (columnId?: string) => void;
  onRestoreTask: (task: Task) => void;
  onQuickMoveTask: (taskId: string, targetColId: string) => Promise<void>;
  isAddingColumn: boolean;
  onStartAddColumn: () => void;
  onCancelAddColumn: () => void;
  onCreateColumn: (title: string) => Promise<void>;
  addColumnRef?: React.Ref<HTMLDivElement>;
}

export const TableView: React.FC<TableViewProps> = ({
  columns,
  deletedTasks,
  showDeletedCards,
  onTaskClick,
  onAddTask,
  onRestoreTask,
  onQuickMoveTask,
  isAddingColumn,
  onStartAddColumn,
  onCancelAddColumn,
  onCreateColumn,
  addColumnRef,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedColumnFilter, setSelectedColumnFilter] = useState('ALL');
  const [sortBy, setSortBy] = useState<'id' | 'title' | 'column' | 'priority' | 'dueDate'>('id');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');

  const columnFilterOptions: SelectOption[] = useMemo(() => {
    const opts: SelectOption[] = [
      { value: 'ALL', label: 'All Columns' },
      ...columns.map((c) => ({ value: c.id, label: c.title })),
    ];
    if (showDeletedCards && deletedTasks.length > 0) {
      opts.push({ value: 'DELETED', label: 'Deleted Tasks', icon: '🗑️' });
    }
    return opts;
  }, [columns, showDeletedCards, deletedTasks]);

  const quickMoveOptions: SelectOption[] = useMemo(() => {
    return columns.map((c) => ({ value: c.id, label: c.title }));
  }, [columns]);

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
        } else if (sortBy === 'priority') {
          const weightA = PRIORITY_CONFIG[a.task.priority || 'medium']?.weight || 2;
          const weightB = PRIORITY_CONFIG[b.task.priority || 'medium']?.weight || 2;
          comp = weightA - weightB;
        } else if (sortBy === 'dueDate') {
          const dateA = a.task.dueDate ? new Date(a.task.dueDate).getTime() : 9999999999999;
          const dateB = b.task.dueDate ? new Date(b.task.dueDate).getTime() : 9999999999999;
          comp = dateA - dateB;
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

  const handleSort = (field: 'id' | 'title' | 'column' | 'priority' | 'dueDate') => {
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
          <CustomSelect
            className="table-filter-select-custom"
            value={selectedColumnFilter}
            onChange={(val) => setSelectedColumnFilter(val)}
            options={columnFilterOptions}
            size="sm"
            ariaLabel="Filter by column"
          />
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
            {filteredActiveTasks.length + filteredDeletedTasks.length} {filteredActiveTasks.length + filteredDeletedTasks.length === 1 ? 'task' : 'tasks'}
          </span>
          <button
            type="button"
            className="btn-secondary"
            onClick={onStartAddColumn}
            style={{ padding: '0.45rem 0.85rem', fontSize: '0.8rem' }}
          >
            + Add Column
          </button>
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
                className="th-col-id sortable"
                onClick={() => handleSort('id')}
                title="Click to sort by ID"
              >
                #ID {sortBy === 'id' ? (sortOrder === 'asc' ? '▲' : '▼') : ''}
              </th>
              <th 
                className="th-col-title sortable"
                onClick={() => handleSort('title')}
                title="Click to sort by Title"
              >
                Title {sortBy === 'title' ? (sortOrder === 'asc' ? '▲' : '▼') : ''}
              </th>
              <th 
                className="th-col-column sortable"
                onClick={() => handleSort('column')}
                title="Click to sort by Column"
              >
                Column {sortBy === 'column' ? (sortOrder === 'asc' ? '▲' : '▼') : ''}
              </th>
              <th 
                className="th-col-priority sortable"
                onClick={() => handleSort('priority')}
                title="Click to sort by Priority"
              >
                Priority {sortBy === 'priority' ? (sortOrder === 'asc' ? '▲' : '▼') : ''}
              </th>
              <th 
                className="th-col-due-date sortable"
                onClick={() => handleSort('dueDate')}
                title="Click to sort by Due Date"
              >
                Due Date {sortBy === 'dueDate' ? (sortOrder === 'asc' ? '▲' : '▼') : ''}
              </th>
              <th className="th-col-desc">Description</th>
              <th className="th-col-actions">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredActiveTasks.length === 0 && filteredDeletedTasks.length === 0 ? (
              <tr>
                <td colSpan={7} style={{ textAlign: 'center', padding: '2.5rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>
                  No tasks found matching your filter criteria.
                </td>
              </tr>
            ) : (
              <>
                {/* Active Tasks */}
                {filteredActiveTasks.map(({ task, column }) => {
                  const priority = task.priority || 'medium';
                  const priorityMeta = PRIORITY_CONFIG[priority];
                  const dueDateInfo = getDueDateInfo(task.dueDate);

                  return (
                    <tr
                      key={task.id}
                      onClick={() => onTaskClick(task, false, column.id)}
                      style={{ cursor: 'pointer' }}
                    >
                      <td>
                        <span className="task-badge">#{task.id}</span>
                      </td>
                      <td>
                        <span className="table-task-title" title={task.title}>{task.title}</span>
                      </td>
                      <td onClick={(e) => e.stopPropagation()}>
                        <CustomSelect
                          className="table-col-select-custom"
                          value={column.id}
                          onChange={(newColId) => onQuickMoveTask(task.id, newColId)}
                          options={quickMoveOptions}
                          size="sm"
                          title="Change column"
                          ariaLabel="Change column"
                        />
                      </td>
                      <td>
                        {priorityMeta ? (
                          <span
                            className="priority-chip"
                            style={{
                              color: priorityMeta.color,
                              borderColor: priorityMeta.borderColor,
                              background: priorityMeta.bg,
                            }}
                            title={`Priority: ${priorityMeta.label}`}
                          >
                            <span className="priority-chip-dot" style={{ background: priorityMeta.color }} />
                            {priorityMeta.label}
                          </span>
                        ) : (
                          <span style={{ opacity: 0.5 }}>—</span>
                        )}
                      </td>
                      <td>
                        {dueDateInfo.status !== 'none' ? (
                          <span
                            className={`due-date-chip status-${dueDateInfo.status}`}
                            title={dueDateInfo.fullText}
                          >
                            <span className="due-date-icon">
                              {dueDateInfo.isOverdue ? '⚠️' : dueDateInfo.status === 'today' ? '⚡' : '📅'}
                            </span>
                            <span>{dueDateInfo.badgeText}</span>
                          </span>
                        ) : (
                          <span style={{ opacity: 0.5 }}>—</span>
                        )}
                      </td>
                      <td>
                        <span className="table-task-desc" title={stripRichTextToSnippet(task.description)}>
                          {task.description ? stripRichTextToSnippet(task.description) : <span style={{ opacity: 0.5 }}>—</span>}
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
                  );
                })}

                {/* Soft-Deleted Tasks */}
                {filteredDeletedTasks.map((task) => {
                  const priority = task.priority || 'medium';
                  const priorityMeta = PRIORITY_CONFIG[priority];
                  const dueDateInfo = getDueDateInfo(task.dueDate);

                  return (
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
                        <span className="table-task-title table-task-title-deleted" title={task.title}>
                          {task.title}
                        </span>
                      </td>
                      <td>
                        <span style={{ color: 'var(--danger)', fontSize: '0.78rem', fontWeight: 600, textTransform: 'uppercase' }}>
                          Deleted
                        </span>
                      </td>
                      <td>
                        {priorityMeta ? (
                          <span
                            className="priority-chip"
                            style={{
                              color: priorityMeta.color,
                              borderColor: priorityMeta.borderColor,
                              background: priorityMeta.bg,
                            }}
                            title={`Priority: ${priorityMeta.label}`}
                          >
                            <span className="priority-chip-dot" style={{ background: priorityMeta.color }} />
                            {priorityMeta.label}
                          </span>
                        ) : (
                          <span style={{ opacity: 0.5 }}>—</span>
                        )}
                      </td>
                      <td>
                        {dueDateInfo.status !== 'none' ? (
                          <span
                            className={`due-date-chip status-${dueDateInfo.status}`}
                            title={dueDateInfo.fullText}
                          >
                            <span className="due-date-icon">
                              {dueDateInfo.isOverdue ? '⚠️' : dueDateInfo.status === 'today' ? '⚡' : '📅'}
                            </span>
                            <span>{dueDateInfo.badgeText}</span>
                          </span>
                        ) : (
                          <span style={{ opacity: 0.5 }}>—</span>
                        )}
                      </td>
                      <td>
                        <span className="table-task-desc" title={stripRichTextToSnippet(task.description)}>
                          {task.description ? stripRichTextToSnippet(task.description) : <span style={{ opacity: 0.5 }}>—</span>}
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
                  );
                })}
              </>
            )}
          </tbody>
        </table>
      </div>

      {/* Add Column Section in Table View */}
      <div className="table-add-column-section">
        <AddColumn
          ref={addColumnRef}
          isAdding={isAddingColumn}
          onStartAdd={onStartAddColumn}
          onCancel={onCancelAddColumn}
          onSubmit={onCreateColumn}
        />
      </div>
    </div>
  );
};
