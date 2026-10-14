import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Column } from '../types';

interface BoardMinimapProps {
  boardAreaRef: React.RefObject<HTMLElement | null>;
  columns: Column[];
  deletedTasksCount: number;
  showDeletedCards: boolean;
  onAddColumnClick: () => void;
}

export const BoardMinimap: React.FC<BoardMinimapProps> = ({
  boardAreaRef,
  columns,
  deletedTasksCount,
  showDeletedCards,
  onAddColumnClick,
}) => {
  const [scrollInfo, setScrollInfo] = useState({
    scrollLeft: 0,
    scrollWidth: 0,
    clientWidth: 0,
  });
  const [isDragging, setIsDragging] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(false);

  const trackRef = useRef<HTMLDivElement>(null);
  const dragStartRef = useRef<{ startX: number; startScrollLeft: number } | null>(null);

  // Synchronize scroll and size metrics from the board canvas
  const updateMetrics = useCallback(() => {
    const el = boardAreaRef.current;
    if (!el) return;
    setScrollInfo({
      scrollLeft: el.scrollLeft,
      scrollWidth: el.scrollWidth,
      clientWidth: el.clientWidth,
    });
  }, [boardAreaRef]);

  useEffect(() => {
    const el = boardAreaRef.current;
    if (!el) return;

    updateMetrics();

    const handleScroll = () => {
      setScrollInfo({
        scrollLeft: el.scrollLeft,
        scrollWidth: el.scrollWidth,
        clientWidth: el.clientWidth,
      });
    };

    el.addEventListener('scroll', handleScroll, { passive: true });
    window.addEventListener('resize', updateMetrics);

    const resizeObserver = new ResizeObserver(() => {
      updateMetrics();
    });
    resizeObserver.observe(el);

    return () => {
      el.removeEventListener('scroll', handleScroll);
      window.removeEventListener('resize', updateMetrics);
      resizeObserver.disconnect();
    };
  }, [boardAreaRef, updateMetrics, columns.length, showDeletedCards]);

  const { scrollLeft, scrollWidth, clientWidth } = scrollInfo;
  const maxScroll = Math.max(0, scrollWidth - clientWidth);

  // Compute track width and lens position/width
  const trackWidth = trackRef.current ? trackRef.current.clientWidth : 420;
  const ratio = scrollWidth > 0 ? clientWidth / scrollWidth : 1;
  const lensWidth = Math.max(48, Math.min(trackWidth, ratio * trackWidth));
  const maxLensTravel = Math.max(1, trackWidth - lensWidth);
  const lensLeft = maxScroll > 0 ? Math.max(0, Math.min(maxLensTravel, (scrollLeft / maxScroll) * maxLensTravel)) : 0;

  // Viewport Lens Drag Interaction
  const handleLensMouseDown = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    if (!boardAreaRef.current || maxScroll <= 0) return;

    setIsDragging(true);
    dragStartRef.current = {
      startX: e.clientX,
      startScrollLeft: boardAreaRef.current.scrollLeft,
    };

    const handleMouseMove = (moveEvent: MouseEvent) => {
      if (!dragStartRef.current || !boardAreaRef.current) return;
      const deltaX = moveEvent.clientX - dragStartRef.current.startX;
      const scrollDelta = (deltaX / maxLensTravel) * maxScroll;
      boardAreaRef.current.scrollLeft = Math.max(
        0,
        Math.min(maxScroll, dragStartRef.current.startScrollLeft + scrollDelta)
      );
    };

    const handleMouseUp = () => {
      setIsDragging(false);
      dragStartRef.current = null;
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
  };

  // Click on Track to jump to location
  const handleTrackClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!trackRef.current || !boardAreaRef.current || maxScroll <= 0) return;
    const rect = trackRef.current.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const targetLensCenter = clickX - lensWidth / 2;
    const targetRatio = Math.max(0, Math.min(1, targetLensCenter / maxLensTravel));
    const targetScroll = targetRatio * maxScroll;

    boardAreaRef.current.scrollTo({
      left: targetScroll,
      behavior: 'smooth',
    });
  };

  // Step scroll button navigation
  const handleStepScroll = (direction: 'left' | 'right') => {
    if (!boardAreaRef.current) return;
    const step = 350; // Standard column width + gap
    boardAreaRef.current.scrollBy({
      left: direction === 'left' ? -step : step,
      behavior: 'smooth',
    });
  };

  // Direct click on a mini column preview to jump to that column
  const handleColumnJump = (index: number, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!boardAreaRef.current) return;
    const step = 350;
    boardAreaRef.current.scrollTo({
      left: index * step,
      behavior: 'smooth',
    });
  };

  const isAtStart = scrollLeft <= 5;
  const isAtEnd = scrollLeft >= maxScroll - 5;

  return (
    <div className={`board-minimap-wrapper ${isCollapsed ? 'collapsed' : ''}`}>
      {isCollapsed ? (
        <button
          type="button"
          className="minimap-toggle-pill"
          onClick={() => setIsCollapsed(false)}
          title="Expand Board Minimap Navigation"
        >
          <span className="minimap-icon">🗺️</span>
          <span>Minimap</span>
          <span className="minimap-count-chip">{columns.length}</span>
        </button>
      ) : (
        <div className="board-minimap">
          {/* Left Arrow Button */}
          <button
            type="button"
            className="minimap-nav-btn"
            onClick={() => handleStepScroll('left')}
            disabled={isAtStart || maxScroll <= 0}
            title="Scroll left"
          >
            ◀
          </button>

          {/* Minimap Track with miniature column previews */}
          <div
            ref={trackRef}
            className="minimap-track"
            onClick={handleTrackClick}
            title="Click or drag to navigate board"
          >
            <div className="minimap-columns-grid">
              {columns.map((col, idx) => (
                <div
                  key={col.id}
                  className="minimap-col-node"
                  onClick={(e) => handleColumnJump(idx, e)}
                  title={`${col.title} (${col.tasks.length} tasks)`}
                >
                  <div className="minimap-col-accent" />
                  <span className="minimap-col-label">{col.title}</span>
                  <div className="minimap-card-bars">
                    {col.tasks.slice(0, 3).map((_, tIdx) => (
                      <div key={tIdx} className="minimap-card-bar" />
                    ))}
                    {col.tasks.length > 3 && (
                      <span className="minimap-more-dots">+{col.tasks.length - 3}</span>
                    )}
                  </div>
                </div>
              ))}

              {/* Deleted Column preview if active */}
              {showDeletedCards && deletedTasksCount > 0 && (
                <div
                  className="minimap-col-node minimap-col-deleted"
                  onClick={(e) => handleColumnJump(columns.length, e)}
                  title={`Deleted Cards (${deletedTasksCount})`}
                >
                  <div className="minimap-col-accent minimap-accent-danger" />
                  <span className="minimap-col-label" style={{ color: 'var(--danger)' }}>DEL</span>
                  <span className="minimap-del-count">{deletedTasksCount}</span>
                </div>
              )}

              {/* Add Column Slot preview */}
              <div
                className="minimap-col-node minimap-col-add"
                onClick={(e) => {
                  e.stopPropagation();
                  onAddColumnClick();
                }}
                title="Add Column"
              >
                <span className="minimap-add-plus">+</span>
              </div>
            </div>

            {/* Interactive Viewport Lens */}
            <div
              className={`minimap-lens ${isDragging ? 'dragging' : ''}`}
              style={{
                left: `${lensLeft}px`,
                width: `${lensWidth}px`,
              }}
              onMouseDown={handleLensMouseDown}
              title="Drag to pan board"
            >
              <div className="minimap-lens-handle">
                <span />
                <span />
                <span />
              </div>
            </div>
          </div>

          {/* Right Arrow Button */}
          <button
            type="button"
            className="minimap-nav-btn"
            onClick={() => handleStepScroll('right')}
            disabled={isAtEnd || maxScroll <= 0}
            title="Scroll right"
          >
            ▶
          </button>

          {/* Minimize toggle button */}
          <button
            type="button"
            className="minimap-collapse-btn"
            onClick={() => setIsCollapsed(true)}
            title="Minimize map"
          >
            ✕
          </button>
        </div>
      )}
    </div>
  );
};
