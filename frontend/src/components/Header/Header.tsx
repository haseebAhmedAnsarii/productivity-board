import './Header.scss';
import React from 'react';
import { ViewMode, ThemeMode } from '../../types';
import { CustomSelect, SelectOption } from '../CustomSelect';

const themeOptions: SelectOption[] = [
  { value: 'default', label: 'Default', icon: '💻' },
  { value: 'dark', label: 'Dark', icon: '🌙' },
  { value: 'light', label: 'Light', icon: '☀️' },
];

interface HeaderProps {
  authUsername: string;
  deletedTasksCount: number;
  showDeletedCards: boolean;
  viewMode: ViewMode;
  onViewModeChange: (mode: ViewMode) => void;
  onToggleDeletedCards: () => void;
  onAddColumnClick: () => void;
  onLogoutClick: () => void;
  onOpenCommandPalette?: () => void;
  themeMode: ThemeMode;
  onThemeModeChange: (mode: ThemeMode) => void;
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
  onOpenCommandPalette,
  themeMode,
  onThemeModeChange,
}) => {
  return (
    <header className="header">
      <div className="header-left">
        <h1 className="header-brand">
          <span className="brand-full">Bento Board</span>
          <span className="brand-short">Bento</span>
        </h1>
        <div className="view-switcher" role="group" aria-label="View Switcher">
          <button 
            type="button"
            className={`view-btn ${viewMode === 'board' ? 'active' : ''}`}
            onClick={() => onViewModeChange('board')}
            title="Board View"
            aria-label="Board View"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
              <line x1="9" y1="3" x2="9" y2="21" />
              <line x1="15" y1="3" x2="15" y2="21" />
            </svg>
            <span className="view-btn-label">Board</span>
          </button>
          <button 
            type="button"
            className={`view-btn ${viewMode === 'list' ? 'active' : ''}`}
            onClick={() => onViewModeChange('list')}
            title="List View"
            aria-label="List View"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="8" y1="6" x2="21" y2="6" />
              <line x1="8" y1="12" x2="21" y2="12" />
              <line x1="8" y1="18" x2="21" y2="18" />
              <line x1="3" y1="6" x2="3.01" y2="6" />
              <line x1="3" y1="12" x2="3.01" y2="12" />
              <line x1="3" y1="18" x2="3.01" y2="18" />
            </svg>
            <span className="view-btn-label">List</span>
          </button>
          <button 
            type="button"
            className={`view-btn ${viewMode === 'table' ? 'active' : ''}`}
            onClick={() => onViewModeChange('table')}
            title="Table View"
            aria-label="Table View"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 3H5a2 2 0 0 0-2 2v4m6-6h10a2 2 0 0 1 2 2v4M9 3v18m0 0h10a2 2 0 0 0 2-2V9M9 21H5a2 2 0 0 1-2-2V9m0 0h18" />
            </svg>
            <span className="view-btn-label">Table</span>
          </button>
        </div>
        {onOpenCommandPalette && (
          <button
            type="button"
            className="header-command-trigger"
            onClick={onOpenCommandPalette}
            title="Open Command Palette (Ctrl+K)"
            aria-label="Open Command Palette"
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="11" cy="11" r="8" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
            <span className="cmd-text-full">Search or command...</span>
            <span className="cmd-text-short">Search...</span>
            <kbd className="cmd-kbd">Ctrl K</kbd>
          </button>
        )}
      </div>
      <div className="user-profile">
        {deletedTasksCount > 0 && (
          <button 
            type="button"
            onClick={onToggleDeletedCards}
            className={`header-deleted-btn ${showDeletedCards ? "btn-secondary" : "btn-deleted-cta"}`}
            title={showDeletedCards ? `Hide Deleted Cards (${deletedTasksCount})` : `Show Deleted Cards (${deletedTasksCount})`}
          >
            <span className="deleted-label-full">
              {showDeletedCards ? 'Hide Deleted' : 'Show Deleted'} ({deletedTasksCount})
            </span>
            <span className="deleted-label-short">
              🗑️ {deletedTasksCount}
            </span>
          </button>
        )}
        <button 
          type="button"
          className="btn-primary header-add-col-btn" 
          onClick={onAddColumnClick}
          title="Add new column"
        >
          <span className="add-col-text-full">+ Add Column</span>
          <span className="add-col-text-short">+ Column</span>
          <span className="add-col-text-mini">+</span>
        </button>
        <div className="header-theme-wrap">
          <CustomSelect
            className="theme-select-custom"
            value={themeMode}
            onChange={(val) => onThemeModeChange(val as ThemeMode)}
            options={themeOptions}
            size="sm"
            title="Theme Mode (Default, Dark, Light)"
            ariaLabel="Theme Mode"
          />
        </div>
        <button type="button" onClick={onLogoutClick} className="logout-btn" title="Log out" aria-label="Log out">
          <span className="logout-text-full">Logout</span>
          <svg className="logout-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
            <polyline points="16 17 21 12 16 7" />
            <line x1="21" y1="12" x2="9" y2="12" />
          </svg>
        </button>
        <div className="user-avatar" title={`Logged in as ${authUsername || 'User'}`}>
          {authUsername ? authUsername.charAt(0).toUpperCase() : 'U'}
        </div>
      </div>
    </header>
  );
};
