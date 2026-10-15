import React from 'react';
import { Task } from '../types';
import { stripRichTextToSnippet } from './RichTextRenderer';

interface DeletedColumnProps {
  deletedTasks: Task[];
  onTaskClick: (task: Task) => void;
  onRestoreTask: (task: Task) => void;
}

export const DeletedColumn = React.forwardRef<HTMLDivElement, DeletedColumnProps>(
  ({ deletedTasks, onTaskClick, onRestoreTask }, ref) => {
    return (
      <div ref={ref} className="kanban-column deleted-column">
        <div className="column-header">
          <span className="column-header-title" style={{ color: 'var(--danger)' }}>
            Deleted
          </span>
          <span className="task-count" style={{ borderColor: 'var(--danger-muted)', color: 'var(--danger)' }}>
            {deletedTasks.length}
          </span>
        </div>
        
        <div className="task-list">
          {deletedTasks.map((task) => {
            const descSnippet = stripRichTextToSnippet(task.description);
            return (
              <div
                key={task.id}
                className="task-card task-card-deleted"
                onClick={() => onTaskClick(task)}
              >
                <div className="task-card-header">
                  <span className="task-badge task-badge-deleted">#{task.id}</span>
                </div>
                <div className="task-title" style={{ textDecoration: 'line-through', opacity: 0.85 }}>
                  {task.title}
                </div>
                {descSnippet && (
                  <div className="task-desc" title={descSnippet}>
                    {descSnippet}
                  </div>
                )}
                <div style={{ marginTop: '0.65rem', display: 'flex', justifyContent: 'flex-end' }}>
                  <button
                    className="btn-restore-mini"
                    onClick={(e) => {
                      e.stopPropagation();
                      onRestoreTask(task);
                    }}
                  >
                    Restore
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  }
);


DeletedColumn.displayName = 'DeletedColumn';
