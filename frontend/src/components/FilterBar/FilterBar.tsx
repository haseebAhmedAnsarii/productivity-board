import './FilterBar.scss';
import React from 'react';
import { DueDateFilter } from '../../types';

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
}) => {
  return (
    <div className="filter-bar">
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
        <div className="filter-select-wrap">
          <label className="filter-label" htmlFor="priority-filter-select">
            Priority:
          </label>
          <select
            id="priority-filter-select"
            className={`filter-select ${priorityFilter !== 'all' ? 'filter-active' : ''}`}
            value={priorityFilter}
            onChange={(e) => onPriorityChange(e.target.value)}
          >
            <option value="all">All Priorities</option>
            <option value="critical">🔴 Critical</option>
            <option value="high">🟠 High</option>
            <option value="medium">🟡 Medium</option>
            <option value="low">🟢 Low</option>
          </select>
        </div>

        {/* Due Date Filter */}
        <div className="filter-select-wrap">
          <label className="filter-label" htmlFor="duedate-filter-select">
            Due Date:
          </label>
          <select
            id="duedate-filter-select"
            className={`filter-select ${dueDateFilter !== 'all' ? 'filter-active' : ''}`}
            value={dueDateFilter}
            onChange={(e) => onDueDateChange(e.target.value as DueDateFilter)}
          >
            <option value="all">All Dates</option>
            <option value="overdue">⚠️ Overdue</option>
            <option value="today">⚡ Due Today</option>
            <option value="week">📅 Next 7 Days</option>
            <option value="has_date">🏷️ Has Due Date</option>
            <option value="no_date">⚪ No Due Date</option>
          </select>
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
  );
};
