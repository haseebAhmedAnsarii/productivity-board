import './FilterBar.scss';
import React from 'react';
import { DueDateFilter } from '../../types';
import { CustomSelect, SelectOption } from '../CustomSelect';

const priorityOptions: SelectOption[] = [
  { value: 'all', label: 'All Priorities' },
  { value: 'critical', label: 'Critical', icon: '🔴' },
  { value: 'high', label: 'High', icon: '🔺' },
  { value: 'medium', label: 'Medium', icon: '🔵' },
  { value: 'low', label: 'Low', icon: '🟢' },
];

const dueDateOptions: SelectOption[] = [
  { value: 'all', label: 'All Dates' },
  { value: 'overdue', label: 'Overdue', icon: '⚠️' },
  { value: 'today', label: 'Due Today', icon: '⚡' },
  { value: 'week', label: 'Next 7 Days', icon: '📅' },
  { value: 'has_date', label: 'Has Due Date', icon: '🏷️' },
  { value: 'no_date', label: 'No Due Date', icon: '⚪' },
];

interface FilterBarProps {
  searchQuery: string;
  onSearchChange: (query: string) => void;
  priorityFilter: string;
  onPriorityChange: (priority: string) => void;
  dueDateFilter: DueDateFilter;
  onDueDateChange: (filter: DueDateFilter) => void;
  isFilterActive: boolean;
  onClearFilters: () => void;
  totalTasksCount: number;
  filteredTasksCount: number;
  isMobileExpanded?: boolean;
  onToggleMobileExpand?: () => void;
}

export const FilterBar: React.FC<FilterBarProps> = ({
  searchQuery,
  onSearchChange,
  priorityFilter,
  onPriorityChange,
  dueDateFilter,
  onDueDateChange,
  isFilterActive,
  onClearFilters,
  totalTasksCount,
  filteredTasksCount,
  isMobileExpanded = false,
  onToggleMobileExpand,
}) => {
  return (
    <div className={`filter-bar ${isMobileExpanded ? 'mobile-expanded' : 'mobile-collapsed'} ${isFilterActive ? 'has-active-filter' : ''}`}>
      {/* Mobile Compact Active Filter Pill Bar (Shown when collapsed and filter active) */}
      {isFilterActive && !isMobileExpanded && (
        <div className="filter-mobile-active-strip">
          <div className="filter-mobile-strip-left" onClick={onToggleMobileExpand}>
            <span className="filter-strip-badge">Filtered:</span>
            {searchQuery && (
              <span className="filter-tag-pill">
                "{searchQuery}"
              </span>
            )}
            {priorityFilter !== 'all' && (
              <span className="filter-tag-pill">
                {priorityFilter.toUpperCase()}
              </span>
            )}
            {dueDateFilter !== 'all' && (
              <span className="filter-tag-pill">
                {dueDateFilter.toUpperCase()}
              </span>
            )}
            <span className="filter-strip-count">
              ({filteredTasksCount}/{totalTasksCount})
            </span>
          </div>
          <button
            type="button"
            className="filter-strip-clear-btn"
            onClick={onClearFilters}
            title="Clear all filters"
          >
            ✕ Clear
          </button>
        </div>
      )}

      {/* Main Filter Toolbar Controls */}
      <div className="filter-bar-content">
        <div className="filter-bar-left">
        {/* Search Input */}
        <div className="filter-search-wrap">
          <svg
            className="filter-search-icon"
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <input
            type="text"
            className="filter-search-input"
            placeholder="Filter tasks by keyword..."
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
          />
          {searchQuery && (
            <button
              type="button"
              className="filter-search-clear"
              onClick={() => onSearchChange('')}
              title="Clear search"
            >
              ✕
            </button>
          )}
        </div>

        {/* Priority Filter */}
        <div className="filter-select-wrap filter-priority-wrap">
          <label className="filter-label" htmlFor="priority-filter-select">
            Priority:
          </label>
          <CustomSelect
            id="priority-filter-select"
            className={priorityFilter !== 'all' ? 'filter-active' : ''}
            value={priorityFilter}
            onChange={(val) => onPriorityChange(val)}
            options={priorityOptions}
            size="sm"
            ariaLabel="Priority filter"
          />
        </div>

        {/* Due Date Filter */}
        <div className="filter-select-wrap filter-duedate-wrap">
          <label className="filter-label" htmlFor="duedate-filter-select">
            Due Date:
          </label>
          <CustomSelect
            id="duedate-filter-select"
            className={dueDateFilter !== 'all' ? 'filter-active' : ''}
            value={dueDateFilter}
            onChange={(val) => onDueDateChange(val as DueDateFilter)}
            options={dueDateOptions}
            size="sm"
            ariaLabel="Due date filter"
          />
        </div>
      </div>

      <div className="filter-bar-right">
        {isFilterActive && (
          <div className="filter-active-status">
            <span className="filter-count-badge">
              Showing {filteredTasksCount} of {totalTasksCount} tasks
            </span>
            <button
              type="button"
              className="filter-reset-btn"
              onClick={onClearFilters}
              title="Clear all active filters"
            >
              <span className="reset-icon">✕</span>
              Clear Filters
            </button>
          </div>
        )}
      </div>
      </div>
    </div>
  );
};
