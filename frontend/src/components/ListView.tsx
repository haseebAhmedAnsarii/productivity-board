import React from 'react';
import { Column, Task } from '../types';

interface ListViewProps {
  columns: Column[];
  deletedTasks: Task[];
  showDeletedCards: boolean;
  onTaskClick: (task: Task, isDeleted?: boolean, columnId?: string) => void;
  onAddTask: (columnId: string) => void;
  onRestoreTask: (task: Task) => void;
  onQuickMoveTask: (taskId: string, targetColId: string) => Promise<void>;
}

export const ListView: React.FC<ListViewProps> = ({
  columns,
  deletedTasks,
  showDeletedCards,
  onTaskClick,
  onAddTask,
  onRestoreTask,
  onQuickMoveTask,
}) => {
  return (
    <div className="list-view-container">
      {columns.map((column) => (
        <div key={column.id} className="list-group">
          <div className="list-group-header">
            <div className="list-group-title-wrap">
              <span className="list-group-title">{column.title}</span>
              <span className="task-count">{column.tasks.length}</span>
            </div>
            <button
              type="button"
              className="btn-primary"
              onClick={() => onAddTask(column.id)}
              style={{ padding: '0.35rem 0.75rem', fontSize: '0.78rem' }}
            >
              + Add Task
            </button>
          </div>

          <div className="list-task-items">
            {column.tasks.length === 0 ? (
              <div className="list-empty-placeholder">
                No tasks in this column. Click &ldquo;+ Add Task&rdquo; to create one.
              </div>
            ) : (
              column.tasks.map((task) => (
                <div
                  key={task.id}
                  className="list-task-row"
                  onClick={() => onTaskClick(task, false, column.id)}
                >
                  <div className="list-task-main">
                    <span className="task-badge">#{task.id}</span>
                    <span className="list-task-title">{task.title}</span>
                    {task.description && (
                      <span className="list-task-desc">{task.description}</span>
                    )}
                  </div>

                  <div className="list-task-meta" onClick={(e) => e.stopPropagation()}>
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
              ))
            )}
          </div>
        </div>
      ))}

      {/* Deleted Tasks Section in List View */}
      {showDeletedCards && deletedTasks.length > 0 && (
        <div className="list-group" style={{ borderColor: 'var(--danger-muted)', borderTopColor: 'var(--danger)' }}>
          <div className="list-group-header">
            <div className="list-group-title-wrap">
              <span className="list-group-title" style={{ color: 'var(--danger)' }}>
                Deleted Tasks
              </span>
              <span className="task-count" style={{ borderColor: 'var(--danger-muted)', color: 'var(--danger)' }}>
                {deletedTasks.length}
              </span>
            </div>
          </div>

          <div className="list-task-items">
            {deletedTasks.map((task) => (
              <div
                key={task.id}
                className="list-task-row"
                style={{ opacity: 0.85 }}
                onClick={() => onTaskClick(task, true)}
              >
                <div className="list-task-main">
                  <span className="task-badge task-badge-deleted">#{task.id}</span>
                  <span className="list-task-title" style={{ textDecoration: 'line-through' }}>
                    {task.title}
                  </span>
                  {task.description && (
                    <span className="list-task-desc">{task.description}</span>
                  )}
                </div>

                <div className="list-task-meta" onClick={(e) => e.stopPropagation()}>
                  <button
                    type="button"
                    className="btn-restore-mini"
                    onClick={() => onRestoreTask(task)}
                  >
                    Restore
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
