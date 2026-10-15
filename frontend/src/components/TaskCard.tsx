import React from 'react';
import { Draggable } from '@hello-pangea/dnd';
import { Task } from '../types';
import { stripRichTextToSnippet } from './RichTextRenderer';

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
            <span className="task-badge">#{task.id}</span>
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
