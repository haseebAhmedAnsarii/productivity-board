import React from 'react';

interface HeaderProps {
  authUsername: string;
  deletedTasksCount: number;
  showDeletedCards: boolean;
  onToggleDeletedCards: () => void;
  onAddColumnClick: () => void;
  onLogoutClick: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  authUsername,
  deletedTasksCount,
  showDeletedCards,
  onToggleDeletedCards,
  onAddColumnClick,
  onLogoutClick,
}) => {
  return (
    <header className="header">
      <h1>Bento Board</h1>
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
