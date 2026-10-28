import './CustomSelect.scss';
import React, { useState, useRef, useEffect, useId, useCallback } from 'react';
import { createPortal } from 'react-dom';

export interface SelectOption {
  value: string;
  label: string;
  icon?: React.ReactNode;
  badge?: string;
}

export interface CustomSelectProps {
  id?: string;
  name?: string;
  value: string;
  onChange: (value: string) => void;
  options: SelectOption[];
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  size?: 'sm' | 'md';
  title?: string;
  ariaLabel?: string;
}

interface DropdownPosition {
  top?: number;
  bottom?: number;
  left: number;
  width: number;
  maxHeight: number;
  openUpward: boolean;
}

export const CustomSelect: React.FC<CustomSelectProps> = ({
  id,
  name,
  value,
  onChange,
  options,
  placeholder = 'Select...',
  disabled = false,
  className = '',
  size = 'md',
  title,
  ariaLabel,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [focusedIndex, setFocusedIndex] = useState(-1);
  const [mounted, setMounted] = useState(false);
  const [position, setPosition] = useState<DropdownPosition | null>(null);

  const containerRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const generatedId = useId();
  const selectId = id || generatedId;

  const selectedOption = options.find((opt) => opt.value === value);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Compute position relative to viewport
  const calculatePosition = useCallback((): DropdownPosition | null => {
    if (!triggerRef.current) return null;
    const rect = triggerRef.current.getBoundingClientRect();
    const viewportHeight = window.innerHeight;
    const viewportWidth = window.innerWidth;

    // Check if trigger is scrolled completely out of view
    if (rect.bottom < 0 || rect.top > viewportHeight || rect.right < 0 || rect.left > viewportWidth) {
      return null;
    }

    const spaceBelow = viewportHeight - rect.bottom;
    const spaceAbove = rect.top;

    // Open upward if space below is too small (< 220px) and space above is larger
    const openUpward = spaceBelow < 220 && spaceAbove > spaceBelow;

    const dropdownWidth = Math.max(rect.width, 160);
    let left = rect.left;

    // Clamp horizontally to avoid off-screen overflow
    if (left + dropdownWidth > viewportWidth - 12) {
      left = Math.max(12, viewportWidth - dropdownWidth - 12);
    }
    if (left < 12) {
      left = 12;
    }

    if (openUpward) {
      return {
        bottom: viewportHeight - rect.top + 4,
        left,
        width: dropdownWidth,
        maxHeight: Math.min(240, Math.max(100, spaceAbove - 16)),
        openUpward: true,
      };
    } else {
      return {
        top: rect.bottom + 4,
        left,
        width: dropdownWidth,
        maxHeight: Math.min(240, Math.max(100, spaceBelow - 16)),
        openUpward: false,
      };
    }
  }, []);

  // Sync position whenever dropdown opens
  useEffect(() => {
    if (isOpen) {
      const pos = calculatePosition();
      if (pos) {
        setPosition(pos);
      } else {
        setIsOpen(false);
      }
    }
  }, [isOpen, calculatePosition]);

  // Handle scroll and resize when open
  useEffect(() => {
    if (!isOpen) return;

    const handleScrollOrResize = (e: Event) => {
      // Don't reposition or close if the scroll is inside the dropdown list itself
      if (listRef.current && listRef.current.contains(e.target as Node)) {
        return;
      }
      const pos = calculatePosition();
      if (pos) {
        setPosition(pos);
      } else {
        setIsOpen(false);
      }
    };

    window.addEventListener('resize', handleScrollOrResize);
    window.addEventListener('scroll', handleScrollOrResize, true);

    return () => {
      window.removeEventListener('resize', handleScrollOrResize);
      window.removeEventListener('scroll', handleScrollOrResize, true);
    };
  }, [isOpen, calculatePosition]);

  // Close when clicking outside (checks both trigger container and dropdown portal list)
  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as Node;
      if (
        containerRef.current &&
        !containerRef.current.contains(target) &&
        listRef.current &&
        !listRef.current.contains(target)
      ) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  // Keep focused index in sync when opening
  useEffect(() => {
    if (isOpen) {
      const idx = options.findIndex((opt) => opt.value === value);
      setFocusedIndex(idx >= 0 ? idx : 0);
    }
  }, [isOpen, options, value]);

  // Scroll focused option into view
  useEffect(() => {
    if (isOpen && listRef.current && focusedIndex >= 0) {
      const items = listRef.current.querySelectorAll('.custom-select-option');
      const targetItem = items[focusedIndex] as HTMLElement;
      if (targetItem) {
        targetItem.scrollIntoView({ block: 'nearest' });
      }
    }
  }, [focusedIndex, isOpen]);

  const handleToggle = () => {
    if (disabled) return;
    if (!isOpen) {
      const pos = calculatePosition();
      if (pos) setPosition(pos);
      setIsOpen(true);
    } else {
      setIsOpen(false);
    }
  };

  const handleSelect = (val: string) => {
    onChange(val);
    setIsOpen(false);
    triggerRef.current?.focus();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (disabled) return;

    if (!isOpen) {
      if (e.key === 'Enter' || e.key === ' ' || e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault();
        const pos = calculatePosition();
        if (pos) setPosition(pos);
        setIsOpen(true);
      }
      return;
    }

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setFocusedIndex((prev) => (prev < options.length - 1 ? prev + 1 : 0));
        break;
      case 'ArrowUp':
        e.preventDefault();
        setFocusedIndex((prev) => (prev > 0 ? prev - 1 : options.length - 1));
        break;
      case 'Enter':
      case ' ':
        e.preventDefault();
        if (focusedIndex >= 0 && options[focusedIndex]) {
          handleSelect(options[focusedIndex].value);
        }
        break;
      case 'Escape':
        e.preventDefault();
        setIsOpen(false);
        triggerRef.current?.focus();
        break;
      case 'Tab':
        setIsOpen(false);
        break;
    }
  };

  const dropdownPortal =
    mounted && isOpen && position && typeof document !== 'undefined'
      ? createPortal(
          <ul
            ref={listRef}
            className={`custom-select-dropdown size-${size} ${position.openUpward ? 'open-upward' : 'open-downward'} ${className}`}
            role="listbox"
            tabIndex={-1}
            aria-labelledby={selectId}
            style={{
              position: 'fixed',
              left: `${position.left}px`,
              top: position.top !== undefined ? `${position.top}px` : 'auto',
              bottom: position.bottom !== undefined ? `${position.bottom}px` : 'auto',
              width: `${position.width}px`,
              maxHeight: `${position.maxHeight}px`,
              zIndex: 100000,
            }}
          >
            {options.map((opt, index) => {
              const isSelected = opt.value === value;
              const isFocused = index === focusedIndex;

              return (
                <li
                  key={opt.value}
                  role="option"
                  aria-selected={isSelected}
                  className={`custom-select-option ${isSelected ? 'is-selected' : ''} ${isFocused ? 'is-focused' : ''}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    handleSelect(opt.value);
                  }}
                  onMouseEnter={() => setFocusedIndex(index)}
                >
                  <div className="custom-select-option-content">
                    {opt.icon && <span className="custom-select-icon">{opt.icon}</span>}
                    <span className="custom-select-label">{opt.label}</span>
                    {opt.badge && <span className="custom-select-badge">{opt.badge}</span>}
                  </div>
                  {isSelected && (
                    <svg
                      className="custom-select-check"
                      width="12"
                      height="12"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="3"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      aria-hidden="true"
                    >
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                  )}
                </li>
              );
            })}
          </ul>,
          document.body
        )
      : null;

  return (
    <div
      ref={containerRef}
      className={`custom-select-container size-${size} ${isOpen ? 'is-open' : ''} ${disabled ? 'is-disabled' : ''} ${className}`}
      title={title}
    >
      <button
        ref={triggerRef}
        id={selectId}
        name={name}
        type="button"
        className="custom-select-trigger"
        onClick={handleToggle}
        onKeyDown={handleKeyDown}
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        aria-label={ariaLabel || title || placeholder}
      >
        <span className="custom-select-trigger-content">
          {selectedOption ? (
            <>
              {selectedOption.icon && <span className="custom-select-icon">{selectedOption.icon}</span>}
              <span className="custom-select-label">{selectedOption.label}</span>
              {selectedOption.badge && <span className="custom-select-badge">{selectedOption.badge}</span>}
            </>
          ) : (
            <span className="custom-select-placeholder">{placeholder}</span>
          )}
        </span>
        <svg
          className="custom-select-chevron"
          width="12"
          height="12"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>

      {dropdownPortal}
    </div>
  );
};
