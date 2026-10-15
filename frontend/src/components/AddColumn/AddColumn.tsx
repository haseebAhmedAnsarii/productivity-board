import './AddColumn.css';
import React, { useState } from 'react';

interface AddColumnProps {
  isAdding: boolean;
  onStartAdd: () => void;
  onCancel: () => void;
  onSubmit: (title: string) => Promise<void>;
}

export const AddColumn = React.forwardRef<HTMLDivElement, AddColumnProps>(
  ({ isAdding, onStartAdd, onCancel, onSubmit }, ref) => {
  const [newColumnTitle, setNewColumnTitle] = useState('');
  const [columnTitleError, setColumnTitleError] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newColumnTitle.trim()) {
      setColumnTitleError(true);
      return;
    }
    await onSubmit(newColumnTitle.trim());
    setNewColumnTitle('');
    setColumnTitleError(false);
  };

  const handleCancel = () => {
    setNewColumnTitle('');
    setColumnTitleError(false);
    onCancel();
  };

  return (
    <div ref={ref} className="add-column-wrapper">
      {!isAdding ? (
        <button 
          className="add-column-btn" 
          onClick={() => {
            setNewColumnTitle('');
            setColumnTitleError(false);
            onStartAdd();
          }}
        >
          <span style={{ fontSize: '1.25rem', lineHeight: 1 }}>+</span>
          <span>Add another column</span>
        </button>
      ) : (
        <form className="add-column-card" onSubmit={handleSubmit}>
          <input
            type="text"
            placeholder="Enter column title..."
            value={newColumnTitle}
            onChange={(e) => {
              setNewColumnTitle(e.target.value);
              if (columnTitleError) setColumnTitleError(false);
            }}
            onKeyDown={(e) => {
              if (e.key === 'Escape') {
                handleCancel();
              }
            }}
            autoFocus
            style={columnTitleError ? { borderColor: 'var(--danger)' } : {}}
          />
          {columnTitleError && (
            <span style={{ color: 'var(--danger)', fontSize: '0.75rem', fontWeight: 500 }}>
              Column title is required
            </span>
          )}
          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
            <button type="submit" className="btn-primary" style={{ padding: '0.5rem 1rem', fontSize: '0.875rem' }}>
              Add Column
            </button>
            <button 
              type="button" 
              onClick={handleCancel}
              style={{ 
                background: 'transparent', 
                border: 'none', 
                color: 'var(--text-muted)', 
                fontSize: '1.25rem', 
                cursor: 'pointer',
                padding: '0.25rem 0.5rem',
                lineHeight: 1
              }}
              onMouseOver={e => e.currentTarget.style.color = 'var(--text-main)'}
              onMouseOut={e => e.currentTarget.style.color = 'var(--text-muted)'}
              title="Cancel"
            >
              ✕
            </button>
          </div>
        </form>
      )}
    </div>
  );
});

AddColumn.displayName = 'AddColumn';
