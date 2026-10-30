import './RestoreTaskModal.scss';
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Column, Task } from '../../types';
import { CustomSelect, SelectOption } from '../CustomSelect';

interface RestoreTaskModalProps {
  task: Task | null;
  columns: Column[];
  onClose: () => void;
  onConfirm: (taskId: string, targetColumnId?: string) => Promise<void>;
}

export const RestoreTaskModal: React.FC<RestoreTaskModalProps> = ({
  task,
  columns,
  onClose,
  onConfirm,
}) => {
  const [selectedColumnId, setSelectedColumnId] = useState<string>('');
  const overlayMouseDownRef = useRef(false);

  useEffect(() => {
    if (task) {
      if (task.originalColumnId) {
        setSelectedColumnId(task.originalColumnId);
      } else if (columns.length > 0) {
        setSelectedColumnId(columns[0].id);
      } else {
        setSelectedColumnId('');
      }
    }
  }, [task, columns]);

  const isOriginalArchived = Boolean(task?.originalColumnId && !columns.some(c => c.id === task.originalColumnId));

  const restoreColumnOptions: SelectOption[] = useMemo(() => {
    if (!task) return [];
    const opts: SelectOption[] = [];
    if (isOriginalArchived) {
      opts.push({
        value: task.originalColumnId || '',
        label: `${task.originalColumnTitle || 'Original Column'} (Resurrect column)`,
      });
    }
    columns.forEach((col) => {
      const isOrig = col.id === task.originalColumnId;
      opts.push({
        value: col.id,
        label: `${col.title}${isOrig ? ' (Original)' : ''}`,
      });
    });
    return opts;
  }, [task, columns, isOriginalArchived]);

  if (!task) return null;

  const handleConfirm = async () => {
    await onConfirm(task.id, selectedColumnId || undefined);
    onClose();
  };

  return (
    <div
      className="modal-overlay"
      onMouseDown={(e) => {
        overlayMouseDownRef.current = e.target === e.currentTarget;
      }}
      onClick={(e) => {
        if (overlayMouseDownRef.current && e.target === e.currentTarget) {
          onClose();
        }
        overlayMouseDownRef.current = false;
      }}
    >
      <div 
        className="modal-content" 
        onMouseDown={(e) => e.stopPropagation()}
        onClick={(e) => e.stopPropagation()} 
        style={{ maxWidth: '440px', textAlign: 'center' }}
      >
        <div className="modal-header" style={{ justifyContent: 'center', position: 'relative' }}>
          <h2>Restore Task</h2>
          <button 
            className="close-btn" 
            onClick={onClose}
            style={{ position: 'absolute', right: 0, top: 0 }}
          >
            &times;
          </button>
        </div>
        
        <p style={{ color: 'var(--text-main)', fontSize: '1.05rem', lineHeight: 1.5, margin: '0.5rem 0' }}>
          Are you sure you want to restore card <span className="task-badge" style={{ verticalAlign: 'middle', margin: '0 0.25rem' }}>#{task.id}</span>
          <strong> &ldquo;{task.title}&rdquo;</strong>?
        </p>

        <div className="form-group" style={{ textAlign: 'left', marginTop: '1.25rem' }}>
          <label htmlFor="restore-column-select">Restore to Column</label>
          <CustomSelect
            id="restore-column-select"
            value={selectedColumnId}
            onChange={(val) => setSelectedColumnId(val)}
            options={restoreColumnOptions}
            size="md"
            ariaLabel="Restore to Column"
          />
        </div>

        {isOriginalArchived && selectedColumnId === task.originalColumnId && (
          <p style={{ color: 'var(--text-muted)', fontSize: '0.825rem', marginTop: '0.5rem', textAlign: 'left', fontStyle: 'italic' }}>
            Note: The original column &ldquo;{task.originalColumnTitle}&rdquo; will be automatically resurrected back to your board.
          </p>
        )}

        <div style={{ display: 'flex', gap: '0.85rem', justifyContent: 'center', marginTop: '1.5rem' }}>
          <button 
            type="button"
            onClick={onClose}
            className="btn-secondary"
            style={{ flex: 1 }}
          >
            Cancel
          </button>
          <button 
            type="button"
            onClick={handleConfirm}
            className="btn-primary"
            style={{ flex: 1 }}
          >
            Restore Task
          </button>
        </div>
      </div>
    </div>
  );
};
