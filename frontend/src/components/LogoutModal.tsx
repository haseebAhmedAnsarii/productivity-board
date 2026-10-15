import React, { useRef } from 'react';

interface LogoutModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
}

export const LogoutModal: React.FC<LogoutModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
}) => {
  const overlayMouseDownRef = useRef(false);

  if (!isOpen) return null;

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
        style={{ maxWidth: '420px', textAlign: 'center' }}
      >
        <div className="modal-header" style={{ justifyContent: 'center', position: 'relative' }}>
          <h2>Confirm Logout</h2>
          <button 
            className="close-btn" 
            onClick={onClose}
            style={{ position: 'absolute', right: 0, top: 0 }}
          >
            &times;
          </button>
        </div>
        
        <p style={{ color: 'var(--text-muted)', fontSize: '1rem', lineHeight: 1.5, margin: '0.5rem 0 1.25rem' }}>
          Are you sure you want to log out of your session?
        </p>

        <div style={{ display: 'flex', gap: '0.85rem', justifyContent: 'center' }}>
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
            Log Out
          </button>
        </div>
      </div>
    </div>
  );
};
