import './ArchiveColumnModal.scss';
import React, { useRef } from 'react';
import { Column } from '../../types';

interface ArchiveColumnModalProps {
  column: Column | null;
  onClose: () => void;
  onConfirm: () => Promise<void>;
}

export const ArchiveColumnModal: React.FC<ArchiveColumnModalProps> = ({
  column,
  onClose,
  onConfirm,
}) => {
  const overlayMouseDownRef = useRef(false);

  if (!column) return null;

  const hasTasks = column.tasks.length > 0;
  const actionLabel = hasTasks ? 'Archive Column' : 'Delete Column';

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
          <h2>{actionLabel}</h2>
          <button 
            className="close-btn" 
            onClick={onClose}
            style={{ position: 'absolute', right: 0, top: 0 }}
          >
            &times;
          </button>
        </div>
        
        <p style={{ color: 'var(--text-main)', fontSize: '1rem', lineHeight: 1.5, margin: '0.5rem 0' }}>
          Are you sure you want to {hasTasks ? 'archive' : 'delete'} <strong>&ldquo;{column.title}&rdquo;</strong>?
        </p>
        {hasTasks && (
          <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', marginBottom: '1.25rem' }}>
            Note: All {column.tasks.length} {column.tasks.length === 1 ? 'task' : 'tasks'} inside this column will be safely moved to the Archived column.
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
            {actionLabel}
          </button>
        </div>
      </div>
    </div>
  );
};
