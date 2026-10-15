import './DeleteColumnModal.css';
import React, { useRef } from 'react';
import { Column } from '../../types';

interface DeleteColumnModalProps {
  column: Column | null;
  onClose: () => void;
  onConfirm: () => Promise<void>;
}

export const DeleteColumnModal: React.FC<DeleteColumnModalProps> = ({
  column,
  onClose,
  onConfirm,
}) => {
  const overlayMouseDownRef = useRef(false);

  if (!column) return null;

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
          <h2>Delete Column</h2>
          <button 
            className="close-btn" 
            onClick={onClose}
            style={{ position: 'absolute', right: 0, top: 0 }}
          >
            &times;
          </button>
        </div>
        
        <p style={{ color: 'var(--text-main)', fontSize: '1rem', lineHeight: 1.5, margin: '0.5rem 0' }}>
          Are you sure you want to delete <strong>&ldquo;{column.title}&rdquo;</strong>?
        </p>
        {column.tasks.length > 0 && (
          <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', marginBottom: '1.25rem' }}>
            Note: All {column.tasks.length} {column.tasks.length === 1 ? 'task' : 'tasks'} inside this column will be safely moved to the Deleted column.
          </p>
        )}

        <div style={{ display: 'flex', gap: '0.85rem', justifyContent: 'center', marginTop: '1rem' }}>
          <button 
            onClick={onClose}
            className="btn-secondary"
            style={{ flex: 1 }}
          >
            Cancel
          </button>
          <button 
            onClick={onConfirm}
            className="btn-danger"
            style={{ flex: 1 }}
          >
            Delete Column
          </button>
        </div>
      </div>
    </div>
  );
};
