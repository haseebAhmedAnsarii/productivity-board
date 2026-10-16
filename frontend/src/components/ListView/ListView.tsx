import './ListView.scss';
import React, { useState } from 'react';
import { Column, Task } from '../../types';
import { AddColumn } from '../AddColumn';
import { stripRichTextToSnippet } from '../RichTextRenderer';
import { PRIORITY_CONFIG, getDueDateInfo } from '../../utils/priorityDateUtils';

interface ListViewProps {
  columns: Column[];
  deletedTasks: Task[];
  showDeletedCards: boolean;
  onTaskClick: (task: Task, isDeleted?: boolean, columnId?: string) => void;
  onAddTask: (columnId: string) => void;
  onRestoreTask: (task: Task) => void;
  onQuickMoveTask: (taskId: string, targetColId: string) => Promise<void>;
  isAddingColumn: boolean;
  onStartAddColumn: () => void;
  onCancelAddColumn: () => void;
  onCreateColumn: (title: string) => Promise<void>;
  addColumnRef?: React.Ref<HTMLDivElement>;
  deletedColumnRef?: React.Ref<HTMLDivElement>;
}

export const ListView: React.FC<ListViewProps> = ({
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
  deletedColumnRef,
}) => {
  const [collapsedCols, setCollapsedCols] = useState<Record<string, boolean>>({});

  const toggleColumn = (columnId: string) => {
    setCollapsedCols((prev) => ({
      ...prev,
      [columnId]: !prev[columnId],
    }));
  };

  return (
    <div className="list-view-container">
      {/* Unified contrast wrapper for all columns in List View */}
      <div className="list-card-container">
        {columns.map((column) => {
          const isCollapsed = !!collapsedCols[column.id];
          return (
            <div key={column.id} className="list-group">
              <div
                className="list-group-header"
                onClick={() => toggleColumn(column.id)}
                title="Click to expand/collapse"
              >
                <div className="list-group-title-wrap">
                  <span className="list-group-chevron">
                    {isCollapsed ? '▶' : '▼'}
                  </span>
                  <span className="list-group-title">{column.title}</span>
                  <span className="task-count">{column.tasks.length}</span>
                </div>
                <button
                  type="button"
                  className="btn-primary"
                  onClick={(e) => {
                    e.stopPropagation();
                    onAddTask(column.id);
                  }}
                  style={{ padding: '0.35rem 0.75rem', fontSize: '0.78rem' }}
                >
                  + Add Task
                </button>
              </div>

              {!isCollapsed && (
                <div className="list-task-items">
                  {column.tasks.length === 0 ? (
                    <div className="list-empty-placeholder">
                      No tasks in this column. Click &ldquo;+ Add Task&rdquo; to create one.
                    </div>
                  ) : (
                    column.tasks.map((task) => {
                      const priority = task.priority || 'medium';
                      const priorityMeta = PRIORITY_CONFIG[priority];
                      const dueDateInfo = getDueDateInfo(task.dueDate);
                      const labels = task.labels ?? [];

                      return (
                        <div
                          key={task.id}
                          className="list-task-row"
                          onClick={() => onTaskClick(task, false, column.id)}
                        >
                          <div className="list-task-main">
                            <span className="task-badge">#{task.id}</span>
                            <div className="list-task-content">
                              <span className="list-task-title" title={task.title}>{task.title}</span>
                              {task.description && (
                                <span className="list-task-desc" title={stripRichTextToSnippet(task.description)}>
                                  {stripRichTextToSnippet(task.description)}
                                </span>
                              )}
                            </div>
                          </div>

                          <div className="list-task-meta" onClick={(e) => e.stopPropagation()}>
                            <div className="list-task-badges">
                              {labels.length > 0 && (
                                <div className="list-task-labels">
                                  {labels.map((label) => (
                                    <span
                                      key={label.id}
                                      className="label-chip"
                                      style={{ background: label.color + '22', borderColor: label.color, color: label.color }}
                                      title={label.name}
                                    >
                                      <span className="label-chip-dot" style={{ background: label.color }} />
                                      {label.name}
                                    </span>
                                  ))}
                                </div>
                              )}
                              {priorityMeta && (
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
                              )}
                              {dueDateInfo.status !== 'none' && (
                                <span
                                  className={`due-date-chip status-${dueDateInfo.status}`}
                                  title={dueDateInfo.fullText}
                                >
                                  <span className="due-date-icon">
                                    {dueDateInfo.isOverdue ? '⚠️' : dueDateInfo.status === 'today' ? '⚡' : '📅'}
                                  </span>
                                  <span>{dueDateInfo.badgeText}</span>
                                </span>
                              )}
                            </div>

                            <select
                              className="table-col-select"
                              value={column.id}
                              onChange={(e) => onQuickMoveTask(task.id, e.target.value)}
                              title="Move to another column"
                            >
                              {columns.map((col) => (
                                <option key={col.id} value={col.id}>
                                  {col.title}
                                </option>
                              ))}
                            </select>
                            <button
                              type="button"
                              className="table-action-icon"
                              onClick={() => onTaskClick(task, false, column.id)}
                              title="Open details"
                            >
                              ✎
                            </button>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              )}
            </div>
          );
        })}

        {/* Deleted Tasks Section in List View */}
        {showDeletedCards && deletedTasks.length > 0 && (
          <div
            ref={deletedColumnRef}
            className="list-group"
            style={{ borderTop: '2px solid var(--danger)' }}
          >
            <div
              className="list-group-header"
              onClick={() => toggleColumn('__DELETED__')}
              title="Click to expand/collapse"
              style={{ background: 'rgba(239, 68, 68, 0.08)' }}
            >
              <div className="list-group-title-wrap">
                <span className="list-group-chevron">
                  {collapsedCols['__DELETED__'] ? '▶' : '▼'}
                </span>
                <span className="list-group-title" style={{ color: 'var(--danger)' }}>
                  Deleted Tasks
                </span>
                <span className="task-count" style={{ borderColor: 'var(--danger-muted)', color: 'var(--danger)' }}>
                  {deletedTasks.length}
                </span>
              </div>
            </div>

            {!collapsedCols['__DELETED__'] && (
              <div className="list-task-items">
                {deletedTasks.map((task) => {
                  const priority = task.priority || 'medium';
                  const priorityMeta = PRIORITY_CONFIG[priority];
                  const dueDateInfo = getDueDateInfo(task.dueDate);

                  return (
                    <div
                      key={task.id}
                      className="list-task-row"
                      style={{ opacity: 0.85 }}
                      onClick={() => onTaskClick(task, true)}
                    >
                      <div className="list-task-main">
                        <span className="task-badge task-badge-deleted">#{task.id}</span>
                        <div className="list-task-content">
                          <span className="list-task-title" style={{ textDecoration: 'line-through' }} title={task.title}>
                            {task.title}
                          </span>
                          {task.description && (
                            <span className="list-task-desc" title={stripRichTextToSnippet(task.description)}>
                              {stripRichTextToSnippet(task.description)}
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="list-task-meta" onClick={(e) => e.stopPropagation()}>
                        <div className="list-task-badges">
                          {priorityMeta && (
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
                          )}
                          {dueDateInfo.status !== 'none' && (
                            <span
                              className={`due-date-chip status-${dueDateInfo.status}`}
                              title={dueDateInfo.fullText}
                            >
                              <span className="due-date-icon">
                                {dueDateInfo.isOverdue ? '⚠️' : dueDateInfo.status === 'today' ? '⚡' : '📅'}
                              </span>
                              <span>{dueDateInfo.badgeText}</span>
                            </span>
                          )}
                        </div>

                        <button
                          type="button"
                          className="btn-restore-mini"
                          onClick={() => onRestoreTask(task)}
                        >
                          Restore
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Add Column Section inside List Card Wrapper */}
        <div className="list-add-column-section">
          <AddColumn
            ref={addColumnRef}
            isAdding={isAddingColumn}
            onStartAdd={onStartAddColumn}
            onCancel={onCancelAddColumn}
            onSubmit={onCreateColumn}
          />
        </div>
      </div>
    </div>
  );
};
