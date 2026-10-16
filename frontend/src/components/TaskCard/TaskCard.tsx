import './TaskCard.scss';
import React from 'react';
import { Draggable } from '@hello-pangea/dnd';
import { Task } from '../../types';
import { stripRichTextToSnippet } from '../RichTextRenderer';
import { PRIORITY_CONFIG, getDueDateInfo } from '../../utils/priorityDateUtils';

interface TaskCardProps {
  task: Task;
  index: number;
  columnId: string;
  onClick: (task: Task, columnId: string) => void;
}

export const TaskCard: React.FC<TaskCardProps> = ({
  task,
  index,
  columnId,
  onClick,
}) => {
  const descSnippet = stripRichTextToSnippet(task.description);
  const labels = task.labels ?? [];
  const priority = task.priority || 'medium';
  const priorityMeta = PRIORITY_CONFIG[priority];
  const dueDateInfo = getDueDateInfo(task.dueDate);

  return (
    <Draggable draggableId={task.id} index={index}>
      {(provided, snapshot) => (
        <div
          className="task-card"
          ref={provided.innerRef}
          {...provided.draggableProps}
          {...provided.dragHandleProps}
          onClick={() => onClick(task, columnId)}
          style={{
            ...provided.draggableProps.style,
            opacity: snapshot.isDragging ? 0.9 : 1,
            boxShadow: snapshot.isDragging ? 'var(--shadow-lg)' : 'var(--shadow-sm)',
          }}
        >
          <div className="task-card-header">
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
              <span className="task-badge">#{task.id}</span>
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
            </div>
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

          {labels.length > 0 && (
            <div className="task-card-labels">
              {labels.map(label => (
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

          <div className="task-title">{task.title}</div>
          {descSnippet && (
            <div className="task-desc" title={descSnippet}>
              {descSnippet}
            </div>
          )}
        </div>
      )}
    </Draggable>
  );
};
