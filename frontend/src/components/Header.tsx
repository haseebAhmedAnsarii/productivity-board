import React from 'react';
import { ViewMode } from '../types';

interface HeaderProps {
  authUsername: string;
  deletedTasksCount: number;
  showDeletedCards: boolean;
  viewMode: ViewMode;
  onViewModeChange: (mode: ViewMode) => void;
  onToggleDeletedCards: () => void;
  onAddColumnClick: () => void;
  onLogoutClick: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  authUsername,
  deletedTasksCount,
  showDeletedCards,
  viewMode,
  onViewModeChange,
  onToggleDeletedCards,
  onAddColumnClick,
  onLogoutClick,
}) => {
  return (
    <header className="header">
      <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem' }}>
        <h1>Bento Board</h1>
        <div className="view-switcher">
          <button 
            type="button"
            className={`view-btn ${viewMode === 'board' ? 'active' : ''}`}
            onClick={() => onViewModeChange('board')}
            title="Board View"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
              <line x1="9" y1="3" x2="9" y2="21" />
              <line x1="15" y1="3" x2="15" y2="21" />
            </svg>
            <span>Board</span>
          </button>
          <button 
            type="button"
            className={`view-btn ${viewMode === 'list' ? 'active' : ''}`}
            onClick={() => onViewModeChange('list')}
            title="List View"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="8" y1="6" x2="21" y2="6" />
              <line x1="8" y1="12" x2="21" y2="12" />
              <line x1="8" y1="18" x2="21" y2="18" />
              <line x1="3" y1="6" x2="3.01" y2="6" />
              <line x1="3" y1="12" x2="3.01" y2="12" />
              <line x1="3" y1="18" x2="3.01" y2="18" />
            </svg>
            <span>List</span>
          </button>
          <button 
            type="button"
            className={`view-btn ${viewMode === 'table' ? 'active' : ''}`}
            onClick={() => onViewModeChange('table')}
            title="Table View"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 3H5a2 2 0 0 0-2 2v4m6-6h10a2 2 0 0 1 2 2v4M9 3v18m0 0h10a2 2 0 0 0 2-2V9M9 21H5a2 2 0 0 1-2-2V9m0 0h18" />
            </svg>
            <span>Table</span>
          </button>
        </div>
      </div>
      <div className="user-profile">
        {deletedTasksCount > 0 && (
          <button 
            onClick={onToggleDeletedCards}
            className={showDeletedCards ? "btn-secondary" : "btn-deleted-cta"}
            style={{ padding: '0.45rem 0.85rem', fontSize: '0.8rem' }}
          >
            {showDeletedCards ? (
              <>Hide Deleted Cards ({deletedTasksCount})</>
            ) : (
              <>Show Deleted Cards ({deletedTasksCount})</>
            )}
          </button>
        )}
        <button 
          className="btn-primary" 
          onClick={onAddColumnClick}
          style={{ padding: '0.45rem 0.85rem', fontSize: '0.8rem' }}
        >
          + Add Column
        </button>
        <button onClick={onLogoutClick} className="logout-btn">
          Logout
        </button>
        <div className="user-avatar">
          {authUsername ? authUsername.charAt(0).toUpperCase() : 'U'}
        </div>
      </div>
    </header>
  );
};
