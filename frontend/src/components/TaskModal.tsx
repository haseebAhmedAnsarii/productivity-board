import React, { useState, useEffect, useRef } from 'react';
import { Column, HistoryItem, Label, SelectedTask, Task } from '../types';
import { RichTextEditor } from './RichTextEditor';
import { stripRichTextToSnippet } from './RichTextRenderer';
import { LabelPicker } from './LabelPicker';

interface TaskModalProps {
  selectedTask: SelectedTask;
  columns: Column[];
  token: string | null;
  isDeleted: boolean;
  boardId: string;
  onClose: () => void;
  onSave: (title: string, description: string, columnId: string, labelIds?: number[]) => Promise<void>;
  onDelete: () => Promise<void>;
  onRestore: (task: Task) => void;
  onQuickMove: (targetColId: string) => Promise<void>;
}

export const TaskModal: React.FC<TaskModalProps> = ({
  selectedTask,
  columns,
  token,
  isDeleted,
  boardId,
  onClose,
  onSave,
  onDelete,
  onRestore,
  onQuickMove,
}) => {
  const [editTitle, setEditTitle] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editColumnId, setEditColumnId] = useState('');
  const [titleError, setTitleError] = useState(false);
  const [copiedId, setCopiedId] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [taskHistory, setTaskHistory] = useState<HistoryItem[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [expandedHistoryIds, setExpandedHistoryIds] = useState<Record<number, boolean>>({});
  const [taskLabels, setTaskLabels] = useState<Label[]>([]);
  const [allBoardLabels, setAllBoardLabels] = useState<Label[]>([]);
  const overlayMouseDownRef = useRef(false);

  useEffect(() => {
    if (!selectedTask) return;

    // Always reload board labels when modal opens
    if (token && boardId) {
      fetchBoardLabels();
    }

    if ('isNew' in selectedTask) {
      setEditTitle('');
      setEditDescription('');
      setEditColumnId(selectedTask.columnId);
      setTitleError(false);
      setShowDeleteConfirm(false);
      setTaskHistory([]);
      setShowHistory(false);
      setTaskLabels([]);
    } else {
      setEditTitle(selectedTask.title);
      setEditDescription(selectedTask.description);
      setTitleError(false);
      setShowDeleteConfirm(false);
      setShowHistory(false);
      // Seed task labels from task object (populated by page.tsx)
      setTaskLabels(selectedTask.labels ?? []);

      let currentId = selectedTask.columnId || '';
      if (!currentId) {
        const parentCol = columns.find(c => c.tasks.some(t => t.id === selectedTask.id));
        if (parentCol) currentId = parentCol.id;
      }
      if (!currentId && isDeleted && selectedTask.originalColumnId) {
        currentId = selectedTask.originalColumnId;
      }
      if (!currentId && columns.length > 0) {
        currentId = columns[0].id;
      }
      setEditColumnId(currentId);

      if (selectedTask.id && token) {
        fetchTaskHistory(selectedTask.id);
      }
    }
  }, [selectedTask, isDeleted, token, columns, boardId]);

  const fetchBoardLabels = async () => {
    if (!token || !boardId) return;
    try {
      const res = await fetch(`http://localhost:4000/api/labels?boardId=${boardId}`, {
        headers: { 'Authorization': `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setAllBoardLabels(data.labels || []);
      }
    } catch (e) {
      console.error('Failed to load board labels', e);
    }
  };

  const fetchTaskHistory = async (taskId: string) => {
    if (!token) return;
    setLoadingHistory(true);
    try {
      const res = await fetch(`http://localhost:4000/api/tasks/${taskId}/history`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setTaskHistory(data.history || []);
      }
    } catch (err) {
      console.error("Failed to load task history", err);
    } finally {
      setLoadingHistory(false);
    }
  };

  const copyTaskId = (id: string) => {
    navigator.clipboard.writeText(`#${id}`);
    setCopiedId(true);
    setTimeout(() => setCopiedId(false), 1600);
  };

  const formatHistoryTime = (dateStr: string) => {
    try {
      if (!dateStr) return '';
      // SQLite CURRENT_TIMESTAMP is stored in UTC without timezone offset ('YYYY-MM-DD HH:MM:SS').
      // Normalize timestamps missing an explicit timezone offset to UTC so the browser accurately converts to the user's local time.
      const hasTimezone = /[Zz]$|[+-]\d{2}(:?\d{2})?$/.test(dateStr.trim());
      const normalized = hasTimezone ? dateStr.trim() : dateStr.trim().replace(' ', 'T') + 'Z';
      const d = new Date(normalized);
      if (isNaN(d.getTime())) return dateStr;
      return d.toLocaleString('en-US', { 
        month: 'short', 
        day: 'numeric', 
        hour: 'numeric', 
        minute: '2-digit',
        second: '2-digit',
        hour12: true 
      });
    } catch {
      return dateStr;
    }
  };

  const renderHistoryDescription = (item: HistoryItem) => {
    switch (item.change_type) {
      case 'created':
        return `Created this card: "${item.new_value}"`;
      case 'title':
        return (
          <span>
            Renamed title from <span style={{ textDecoration: 'line-through', opacity: 0.7 }}>&ldquo;{item.old_value}&rdquo;</span> to <strong style={{ color: 'var(--text-main)' }}>&ldquo;{item.new_value}&rdquo;</strong>
          </span>
        );
      case 'description': {
        const formatDesc = (val: string | null) => {
          if (!val || val === '(empty)' || !val.trim()) return '(empty)';
          const stripped = stripRichTextToSnippet(val);
          return stripped.trim() || '(empty)';
        };

        const oldText = formatDesc(item.old_value);
        const newText = formatDesc(item.new_value);

        if (oldText === '(empty)' && newText === '(empty)') {
          return 'Updated task description';
        }

        const isLong = oldText.length > 70 || newText.length > 70;
        const isExpanded = !!expandedHistoryIds[item.id];

        const truncateSnippet = (text: string, maxLen = 70) => {
          if (text === '(empty)') return '(empty)';
          if (text.length <= maxLen) return text;
          return text.substring(0, maxLen).trim() + '…';
        };

        const oldSnippet = truncateSnippet(oldText);
        const newSnippet = truncateSnippet(newText);

        return (
          <div>
            <span>
              Updated description from{' '}
              <span
                style={{
                  textDecoration: oldText !== '(empty)' ? 'line-through' : 'none',
                  opacity: 0.7,
                }}
                title={oldText !== '(empty)' ? oldText : undefined}
              >
                {oldText === '(empty)' ? '(empty)' : `“${oldSnippet}”`}
              </span>{' '}
              to{' '}
              <strong
                style={{ color: 'var(--text-main)' }}
                title={newText !== '(empty)' ? newText : undefined}
              >
                {newText === '(empty)' ? '(empty)' : `“${newSnippet}”`}
              </strong>
            </span>

            {isLong && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setExpandedHistoryIds((prev) => ({
                    ...prev,
                    [item.id]: !prev[item.id],
                  }));
                }}
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'var(--accent)',
                  fontSize: '0.72rem',
                  cursor: 'pointer',
                  marginLeft: '0.5rem',
                  textDecoration: 'underline',
                  padding: 0,
                }}
              >
                {isExpanded ? 'Show less' : 'Show full'}
              </button>
            )}

            {isLong && isExpanded && (
              <div
                style={{
                  marginTop: '0.4rem',
                  padding: '0.45rem 0.65rem',
                  background: 'var(--bg-card)',
                  border: '1px solid var(--border-ui)',
                  borderRadius: '6px',
                  fontSize: '0.76rem',
                  lineHeight: '1.45',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.3rem',
                }}
              >
                <div style={{ color: 'var(--text-muted)' }}>
                  <span style={{ color: '#ef4444', fontWeight: 600 }}>Previous: </span>
                  <span style={{ textDecoration: oldText !== '(empty)' ? 'line-through' : 'none' }}>
                    {oldText}
                  </span>
                </div>
                <div style={{ color: 'var(--text-main)' }}>
                  <span style={{ color: '#10b981', fontWeight: 600 }}>New: </span>
                  <span>{newText}</span>
                </div>
              </div>
            )}
          </div>
        );
      }
      case 'moved':
        return `Moved from "${item.old_value}" to "${item.new_value}"`;
      case 'deleted':
        if (item.old_value) {
          const isColumnDeletion = item.new_value?.includes('Column');
          return (
            <span>
              {isColumnDeletion ? (
                <>
                  Column <strong style={{ color: 'var(--text-main)' }}>&ldquo;{item.old_value}&rdquo;</strong> was deleted (card moved to Deleted column)
                </>
              ) : (
                <>
                  Moved card to Deleted column from <strong style={{ color: 'var(--text-main)' }}>&ldquo;{item.old_value}&rdquo;</strong>
                </>
              )}
            </span>
          );
        }
        return 'Moved card to Deleted column';
      case 'restored':
        if (item.new_value && item.new_value !== 'Restored to column') {
          return (
            <span>
              Restored card back to column <strong style={{ color: 'var(--text-main)' }}>&ldquo;{item.new_value}&rdquo;</strong>
            </span>
          );
        }
        return 'Restored card back to active board';
      case 'label_added':
        return (
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem', flexWrap: 'wrap' }}>
            <span style={{ color: '#10b981', fontSize: '0.78rem' }}>🏷</span>
            Added label{' '}
            <span style={{
              display: 'inline-flex', alignItems: 'center', gap: '0.25rem',
              padding: '1px 7px', borderRadius: '3px',
              background: 'rgba(16,185,129,0.12)', border: '1px solid #10b981',
              color: '#10b981', fontWeight: 600, fontSize: '0.72rem',
            }}>
              {item.new_value}
            </span>
          </span>
        );
      case 'label_removed':
        return (
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem', flexWrap: 'wrap' }}>
            <span style={{ color: 'var(--danger)', fontSize: '0.78rem' }}>🏷</span>
            Removed label{' '}
            <span style={{
              display: 'inline-flex', alignItems: 'center', gap: '0.25rem',
              padding: '1px 7px', borderRadius: '3px',
              background: 'rgba(207,79,68,0.12)', border: '1px solid var(--danger)',
              color: 'var(--danger)', fontWeight: 600, fontSize: '0.72rem',
              textDecoration: 'line-through',
            }}>
              {item.old_value}
            </span>
          </span>
        );
      default:
        return item.new_value || item.change_type;
    }
  };


  if (!selectedTask) return null;

  const isNew = 'isNew' in selectedTask;
  const currentTask = !isNew ? (selectedTask as Task) : null;

  const handleSave = async () => {
    if (!editTitle.trim()) {
      setTitleError(true);
      return;
    }
    await onSave(editTitle.trim(), editDescription.trim(), editColumnId, taskLabels.map(l => l.id));
  };

  const handleInternalQuickMove = async (colId: string) => {
    setEditColumnId(colId);
    await onQuickMove(colId);
    if (currentTask?.id) {
      fetchTaskHistory(currentTask.id);
    }
  };

  const handleOverlayMouseDown = (e: React.MouseEvent) => {
    overlayMouseDownRef.current = e.target === e.currentTarget;
  };

  const handleOverlayClick = (e: React.MouseEvent) => {
    if (overlayMouseDownRef.current && e.target === e.currentTarget) {
      onClose();
    }
    overlayMouseDownRef.current = false;
  };

  return (
    <div
      className="modal-overlay"
      onMouseDown={handleOverlayMouseDown}
      onClick={handleOverlayClick}
    >
      <div
        className="modal-content"
        onMouseDown={(e) => e.stopPropagation()}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
            <h2>{isDeleted ? 'Deleted Task' : (isNew ? 'New Task' : 'Edit Task')}</h2>
            {!isNew && currentTask?.id && (
              <button 
                type="button"
                className="modal-task-badge"
                onClick={() => copyTaskId(currentTask.id)}
                title="Click to copy card ID"
              >
                <span>#{currentTask.id}</span>
                {copiedId && <span style={{ fontSize: '0.68rem', opacity: 0.85 }}>Copied!</span>}
              </button>
            )}
          </div>
          <button className="close-btn" onClick={onClose}>&times;</button>
        </div>
        
        {showDeleteConfirm ? (
          <div style={{ textAlign: 'center', padding: '0.75rem 0' }}>
            <p style={{ marginBottom: '1.5rem', fontSize: '1.05rem', color: 'var(--text-main)' }}>Are you sure you want to delete this task? (It will be moved to the Deleted column).</p>
            <div style={{ display: 'flex', gap: '0.85rem', justifyContent: 'center' }}>
              <button 
                onClick={() => setShowDeleteConfirm(false)}
                className="btn-secondary"
              >
                Cancel
              </button>
              <button 
                onClick={onDelete}
                className="btn-danger"
              >
                Yes, Delete Task
              </button>
            </div>
          </div>
        ) : (
          <>
            <div className="form-group">
              <label style={{ display: 'flex', alignItems: 'center' }}>
                Title 
                {titleError && <span style={{ color: 'var(--danger)', marginLeft: '0.5rem', fontSize: '0.75rem', fontWeight: 600 }}>*Required</span>}
              </label>
              <input 
                type="text" 
                value={editTitle} 
                readOnly={isDeleted}
                onChange={(e) => {
                  if (!isDeleted) {
                    setEditTitle(e.target.value);
                    if (titleError) setTitleError(false);
                  }
                }} 
                autoFocus={!isDeleted}
                style={titleError ? { borderColor: 'var(--danger)' } : (isDeleted ? { opacity: 0.8, cursor: 'not-allowed' } : {})}
              />
            </div>

            <div className="form-group">
              <label>Labels</label>
              <LabelPicker
                taskId={currentTask?.id ?? null}
                boardId={boardId}
                token={token || ''}
                taskLabels={taskLabels}
                allLabels={allBoardLabels}
                onLabelsChange={setTaskLabels}
                onBoardLabelsChange={setAllBoardLabels}
                onLabelToggled={() => {
                  if (currentTask?.id) fetchTaskHistory(currentTask.id);
                }}
                readOnly={isDeleted}
              />
            </div>

            <div className="form-group">
              <label htmlFor="task-column-select">
                {isDeleted ? 'Column' : 'Move to Column'}
              </label>
              <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                <select
                  id="task-column-select"
                  value={editColumnId}
                  disabled={isDeleted}
                  onChange={(e) => {
                    if (!isDeleted) setEditColumnId(e.target.value);
                  }}
                  style={{
                    flex: 1,
                    ...(isDeleted ? { opacity: 0.8, cursor: 'not-allowed' } : {})
                  }}
                >
                  {columns.map(col => {
                    const isCurrent = !isDeleted && !isNew && currentTask && col.id === (columns.find(c => c.tasks.some(t => t.id === currentTask.id))?.id);
                    return (
                      <option key={col.id} value={col.id}>
                        {col.title}{isCurrent ? ' (Current)' : ''}
                      </option>
                    );
                  })}
                  {isDeleted && !columns.some(col => col.id === editColumnId) && (
                    <option value={editColumnId}>
                      {(currentTask?.originalColumnTitle) ? currentTask.originalColumnTitle : 'Original Column'}
                    </option>
                  )}
                </select>
                {!isDeleted && !isNew && currentTask && editColumnId && editColumnId !== (columns.find(c => c.tasks.some(t => t.id === currentTask.id))?.id) && (
                  <button
                    type="button"
                    onClick={() => handleInternalQuickMove(editColumnId)}
                    className="btn-secondary"
                    style={{ whiteSpace: 'nowrap', padding: '0.65rem 0.9rem', fontSize: '0.8rem', borderColor: 'var(--accent)', color: 'var(--accent)' }}
                    title="Move card to selected column immediately"
                  >
                    Move Now
                  </button>
                )}
              </div>
            </div>
            
            <div className="form-group">
              <label>Description</label>
              <RichTextEditor
                key={currentTask?.id || 'new-task'}
                value={editDescription}
                onChange={(val) => {
                  if (!isDeleted) setEditDescription(val);
                }}
                readOnly={isDeleted}
                defaultTab="preview"
                placeholder="Add a detailed description... Use the toolbar above or write markdown"
              />
            </div>

            {!isNew && (
              <div className="task-history-section">
                <div 
                  className="task-history-header"
                  onClick={() => setShowHistory(!showHistory)}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <span className="task-history-title">Activity & History</span>
                    {taskHistory.length > 0 && (
                      <span className="task-count" style={{ fontSize: '0.65rem', padding: '1px 5px' }}>
                        {taskHistory.length}
                      </span>
                    )}
                  </div>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                    {showHistory ? '▲ Hide' : '▼ View History'}
                  </span>
                </div>

                {showHistory && (
                  <div className="task-history-timeline">
                    {loadingHistory ? (
                      <div style={{ color: 'var(--text-muted)', fontSize: '0.8rem', padding: '0.5rem 0' }}>
                        Loading history...
                      </div>
                    ) : taskHistory.length === 0 ? (
                      <div style={{ color: 'var(--text-muted)', fontSize: '0.8rem', padding: '0.5rem 0', fontStyle: 'italic' }}>
                        No edit activity recorded yet.
                      </div>
                    ) : (
                      taskHistory.map((item) => (
                        <div key={item.id} className="history-item">
                          <div className="history-dot" />
                          <div className="history-meta">
                            <span className="history-user">@{item.username || 'user'}</span>
                            <span className="history-time">{formatHistoryTime(item.created_at)}</span>
                          </div>
                          <div className="history-desc">
                            {renderHistoryDescription(item)}
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                )}
              </div>
            )}
            
            {isDeleted ? (
              <div style={{ display: 'flex', gap: '0.85rem', marginTop: '0.5rem', flexShrink: 0 }}>
                <button className="btn-secondary" onClick={onClose} style={{ flex: 1 }}>
                  Close
                </button>
                <button 
                  className="btn-primary" 
                  onClick={() => {
                    if (currentTask) {
                      onRestore(currentTask);
                    }
                  }} 
                  style={{ flex: 1 }}
                >
                  Restore Task
                </button>
              </div>
            ) : (
              <div style={{ display: 'flex', gap: '0.85rem', marginTop: '0.5rem', flexShrink: 0 }}>
                <button className="btn-primary" onClick={handleSave} style={{ flex: 1 }}>
                  {isNew ? 'Create Task' : 'Save Changes'}
                </button>
                {!isNew && (
                  <button 
                    onClick={() => setShowDeleteConfirm(true)}
                    className="btn-danger-outline"
                  >
                    Delete
                  </button>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};
