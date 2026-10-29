import './Header.scss';
import React, { useState } from 'react';
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
  isFilterActive?: boolean;
  activeFiltersCount?: number;
  isMobileFilterOpen?: boolean;
  onToggleMobileFilter?: () => void;
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
  isFilterActive = false,
  activeFiltersCount = 0,
  isMobileFilterOpen = false,
  onToggleMobileFilter,
}) => {
  const [isProfileDrawerOpen, setIsProfileDrawerOpen] = useState(false);

  const closeDrawer = () => setIsProfileDrawerOpen(false);

  return (
    <>
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

        {/* Mobile-Only Header Controls (Single 46px row) */}
        <div className="header-mobile-right">
          {onToggleMobileFilter && (
            <button
              type="button"
              className={`header-mobile-filter-btn ${isMobileFilterOpen || isFilterActive ? 'active' : ''}`}
              onClick={onToggleMobileFilter}
              title={isMobileFilterOpen ? 'Close Filters' : 'Open Filters'}
              aria-label="Toggle Filters"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" />
              </svg>
              <span className="mobile-filter-label">Filter</span>
              {activeFiltersCount > 0 && (
                <span className="mobile-filter-badge">{activeFiltersCount}</span>
              )}
            </button>
          )}
          <button
            type="button"
            className="header-mobile-avatar-btn"
            onClick={() => setIsProfileDrawerOpen(true)}
            title={`Account & Settings (${authUsername || 'User'})`}
            aria-label="Open account and settings drawer"
          >
            {authUsername ? authUsername.charAt(0).toUpperCase() : 'U'}
          </button>
        </div>

        {/* Desktop User Profile Group (Hidden on <= 640px) */}
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

      {/* Slide-out Profile & Settings Drawer */}
      <div 
        className={`profile-drawer-backdrop ${isProfileDrawerOpen ? 'open' : ''}`}
        onClick={closeDrawer}
        aria-hidden="true"
      />
      <aside 
        className={`profile-drawer ${isProfileDrawerOpen ? 'open' : ''}`}
        aria-label="User Account & Settings Drawer"
      >
        <div className="drawer-header">
          <h2 className="drawer-title">Account & Settings</h2>
          <button 
            type="button" 
            className="drawer-close-btn" 
            onClick={closeDrawer}
            title="Close Drawer"
            aria-label="Close Drawer"
          >
            ✕
          </button>
        </div>

        {/* User Card */}
        <div className="drawer-user-card">
          <div className="drawer-avatar">
            {authUsername ? authUsername.charAt(0).toUpperCase() : 'U'}
          </div>
          <div className="drawer-user-info">
            <div className="drawer-username">{authUsername || 'User'}</div>
            <div className="drawer-status-pill">Active Session</div>
          </div>
        </div>

        {/* Theme Mode Section */}
        <div className="drawer-section">
          <div className="drawer-section-label">Appearance & Theme</div>
          <CustomSelect
            className="drawer-theme-select"
            value={themeMode}
            onChange={(val) => onThemeModeChange(val as ThemeMode)}
            options={themeOptions}
            size="md"
            title="Select Theme Mode"
            ariaLabel="Theme Mode"
          />
        </div>

        {/* Board Shortcuts */}
        <div className="drawer-section">
          <div className="drawer-section-label">Board Actions</div>
          <button 
            type="button"
            className="drawer-action-btn"
            onClick={() => {
              closeDrawer();
              onAddColumnClick();
            }}
          >
            <span className="action-icon">➕</span>
            <span className="action-text">Add New Column</span>
          </button>
          {deletedTasksCount > 0 && (
            <button 
              type="button"
              className="drawer-action-btn"
              onClick={() => {
                closeDrawer();
                onToggleDeletedCards();
              }}
            >
              <span className="action-icon">🗑️</span>
              <span className="action-text">
                {showDeletedCards ? 'Hide Deleted Tasks' : 'Show Deleted Tasks'}
              </span>
              <span className="drawer-badge">{deletedTasksCount}</span>
            </button>
          )}
          {onOpenCommandPalette && (
            <button 
              type="button"
              className="drawer-action-btn"
              onClick={() => {
                closeDrawer();
                onOpenCommandPalette();
              }}
            >
              <span className="action-icon">⌨️</span>
              <span className="action-text">Command Palette</span>
              <kbd className="drawer-kbd">Ctrl K</kbd>
            </button>
          )}
        </div>

        {/* Sign Out at Bottom */}
        <div className="drawer-footer">
          <button 
            type="button" 
            className="drawer-logout-btn" 
            onClick={() => {
              closeDrawer();
              onLogoutClick();
            }}
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
              <polyline points="16 17 21 12 16 7" />
              <line x1="21" y1="12" x2="9" y2="12" />
            </svg>
            <span>Sign Out</span>
          </button>
        </div>
      </aside>
    </>
  );
};
