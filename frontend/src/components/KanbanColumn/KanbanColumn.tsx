import './KanbanColumn.css';
import React from 'react';
import { Droppable } from '@hello-pangea/dnd';
import { Column, Task } from '../../types';
import { TaskCard } from '../TaskCard';

interface KanbanColumnProps {
  column: Column;
  onDeleteColumn: (column: Column) => void;
  onTaskClick: (task: Task, columnId: string) => void;
  onAddTask: (columnId: string) => void;
}

export const KanbanColumn: React.FC<KanbanColumnProps> = ({
  column,
  onDeleteColumn,
  onTaskClick,
  onAddTask,
}) => {
  return (
    <div className="kanban-column">
      <div className="column-header">
        <span className="column-header-title">{column.title}</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <span className="task-count">{column.tasks.length}</span>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onDeleteColumn(column);
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
              <TaskCard
                key={task.id}
                task={task}
                index={taskIndex}
                columnId={column.id}
                onClick={onTaskClick}
              />
            ))}
            {provided.placeholder}
          </div>
        )}
      </Droppable>

      <button 
        onClick={() => onAddTask(column.id)}
        className="add-task-btn"
      >
        + Add Task
      </button>
    </div>
  );
};
