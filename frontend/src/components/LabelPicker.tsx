import React, { useState, useEffect, useRef } from 'react';
import { Label } from '../types';

// Curated palette of warm, harmonious colors that fit the dark theme
export const LABEL_COLOR_PALETTE = [
  { name: 'Amber',     hex: '#e59a52' },
  { name: 'Terracotta',hex: '#cf4f44' },
  { name: 'Sage',      hex: '#6ba87e' },
  { name: 'Slate Blue',hex: '#5b82c4' },
  { name: 'Mauve',     hex: '#a47db8' },
  { name: 'Sand',      hex: '#c4a96a' },
  { name: 'Coral',     hex: '#d4735a' },
  { name: 'Steel',     hex: '#7a9db0' },
  { name: 'Olive',     hex: '#8da44f' },
  { name: 'Rose',      hex: '#c46a8a' },
  { name: 'Dusk',      hex: '#8475a0' },
  { name: 'Ochre',     hex: '#b89050' },
];

interface LabelPickerProps {
  taskId: string | null;          // null = new task (labels saved after task created)
  boardId: string;
  token: string;
  taskLabels: Label[];            // currently attached labels
  allLabels: Label[];             // all board labels
  onLabelsChange: (labels: Label[]) => void;
  onBoardLabelsChange: (labels: Label[]) => void;
  onLabelToggled?: () => void;   // optional: called after add/remove on existing task
  readOnly?: boolean;
}

export const LabelPicker: React.FC<LabelPickerProps> = ({
  taskId,
  boardId,
  token,
  taskLabels,
  allLabels,
  onLabelsChange,
  onBoardLabelsChange,
  onLabelToggled,
  readOnly = false,
}) => {
  const [open, setOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<Label | null>(null);
  const [newName, setNewName] = useState('');
  const [newColor, setNewColor] = useState(LABEL_COLOR_PALETTE[0].hex);
  const [saving, setSaving] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<number | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const nameInputRef = useRef<HTMLInputElement>(null);

  // Close dropdown on outside click
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpen(false);
        setCreating(false);
        setEditing(null);
        setDeleteConfirm(null);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  useEffect(() => {
    if ((creating || editing) && nameInputRef.current) {
      nameInputRef.current.focus();
    }
  }, [creating, editing]);

  const isAttached = (labelId: number) => taskLabels.some(l => l.id === labelId);

  const toggleLabel = async (label: Label) => {
    if (readOnly) return;
    const nowAttached = isAttached(label.id);
    const nextLabels = nowAttached
      ? taskLabels.filter(l => l.id !== label.id)
      : [...taskLabels, label];

    onLabelsChange(nextLabels);

    if (taskId) {
      try {
        await fetch(`http://localhost:4000/api/labels/task/${taskId}`, {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ labelIds: nextLabels.map(l => l.id) }),
        });
        onLabelToggled?.();
      } catch (e) {
        console.error('Failed to update task labels', e);
      }
    }
  };

  const handleCreateLabel = async () => {
    if (!newName.trim() || saving) return;
    setSaving(true);
    try {
      const res = await fetch('http://localhost:4000/api/labels', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ boardId, name: newName.trim(), color: newColor }),
      });
      if (res.ok) {
        const data = await res.json();
        const updatedAll = [...allLabels, data.label];
        onBoardLabelsChange(updatedAll);
        setCreating(false);
        setNewName('');
        setNewColor(LABEL_COLOR_PALETTE[0].hex);
      }
    } catch (e) {
      console.error('Failed to create label', e);
    } finally {
      setSaving(false);
    }
  };

  const handleUpdateLabel = async () => {
    if (!editing || !newName.trim() || saving) return;
    setSaving(true);
    try {
      const res = await fetch(`http://localhost:4000/api/labels/${editing.id}`, {
        method: 'PUT',
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newName.trim(), color: newColor }),
      });
      if (res.ok) {
        const data = await res.json();
        const updatedAll = allLabels.map(l => l.id === data.label.id ? data.label : l);
        onBoardLabelsChange(updatedAll);
        const updatedTask = taskLabels.map(l => l.id === data.label.id ? data.label : l);
        onLabelsChange(updatedTask);
        setEditing(null);
        setNewName('');
        setNewColor(LABEL_COLOR_PALETTE[0].hex);
      }
    } catch (e) {
      console.error('Failed to update label', e);
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteLabel = async (labelId: number) => {
    try {
      await fetch(`http://localhost:4000/api/labels/${labelId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` },
      });
      onBoardLabelsChange(allLabels.filter(l => l.id !== labelId));
      onLabelsChange(taskLabels.filter(l => l.id !== labelId));
      setDeleteConfirm(null);
    } catch (e) {
      console.error('Failed to delete label', e);
    }
  };

  const startEdit = (label: Label) => {
    setEditing(label);
    setCreating(false);
    setNewName(label.name);
    setNewColor(label.color);
    setDeleteConfirm(null);
  };

  const startCreate = () => {
    setCreating(true);
    setEditing(null);
    setNewName('');
    setNewColor(LABEL_COLOR_PALETTE[0].hex);
    setDeleteConfirm(null);
  };

  return (
    <div className="label-picker-wrapper" ref={dropdownRef}>
      {/* Label chips row */}
      <div className="label-chips-row">
        {taskLabels.map(label => (
          <span
            key={label.id}
            className="label-chip"
            style={{ background: label.color + '22', borderColor: label.color, color: label.color }}
            title={label.name}
          >
            <span className="label-chip-dot" style={{ background: label.color }} />
            {label.name}
          </span>
        ))}
        {!readOnly && (
          <button
            type="button"
            className="label-add-btn"
            onClick={() => setOpen(o => !o)}
            title="Manage labels"
          >
            {taskLabels.length === 0 ? '＋ Add Label' : '＋'}
          </button>
        )}
      </div>

      {/* Dropdown */}
      {open && (
        <div className="label-dropdown">
          <div className="label-dropdown-header">
            <span>Labels</span>
            <button type="button" className="label-close-btn" onClick={() => { setOpen(false); setCreating(false); setEditing(null); }}>×</button>
          </div>

          {/* All board labels list */}
          <div className="label-list">
            {allLabels.length === 0 && !creating && (
              <p className="label-empty-hint">No labels yet. Create one below.</p>
            )}
            {allLabels.map(label => (
              <div key={label.id} className="label-list-row">
                {deleteConfirm === label.id ? (
                  <div className="label-delete-confirm">
                    <span>Delete <strong style={{ color: label.color }}>{label.name}</strong>?</span>
                    <div style={{ display: 'flex', gap: '0.4rem', marginTop: '0.3rem' }}>
                      <button className="label-confirm-del-btn" onClick={() => handleDeleteLabel(label.id)}>Delete</button>
                      <button className="label-cancel-btn" onClick={() => setDeleteConfirm(null)}>Cancel</button>
                    </div>
                  </div>
                ) : editing?.id === label.id ? (
                  <div className="label-form">
                    <input
                      ref={nameInputRef}
                      className="label-name-input"
                      value={newName}
                      onChange={e => setNewName(e.target.value)}
                      onKeyDown={e => { if (e.key === 'Enter') handleUpdateLabel(); if (e.key === 'Escape') setEditing(null); }}
                      placeholder="Label name"
                      maxLength={32}
                    />
                    <div className="label-color-grid">
                      {LABEL_COLOR_PALETTE.map(c => (
                        <button
                          key={c.hex}
                          type="button"
                          className={`label-color-swatch${newColor === c.hex ? ' selected' : ''}`}
                          style={{ background: c.hex }}
                          title={c.name}
                          onClick={() => setNewColor(c.hex)}
                        />
                      ))}
                    </div>
                    <div style={{ display: 'flex', gap: '0.4rem' }}>
                      <button className="label-save-btn" onClick={handleUpdateLabel} disabled={saving || !newName.trim()}>Save</button>
                      <button className="label-cancel-btn" onClick={() => setEditing(null)}>Cancel</button>
                    </div>
                  </div>
                ) : (
                  <>
                    <button
                      type="button"
                      className={`label-toggle-btn${isAttached(label.id) ? ' active' : ''}`}
                      onClick={() => toggleLabel(label)}
                    >
                      <span className="label-toggle-check">{isAttached(label.id) ? '✓' : ''}</span>
                      <span className="label-chip-dot" style={{ background: label.color }} />
                      <span className="label-toggle-name">{label.name}</span>
                    </button>
                    <div className="label-row-actions">
                      <button type="button" className="label-edit-icon-btn" onClick={() => startEdit(label)} title="Edit label">✎</button>
                      <button type="button" className="label-del-icon-btn" onClick={() => setDeleteConfirm(label.id)} title="Delete label">✕</button>
                    </div>
                  </>
                )}
              </div>
            ))}
          </div>

          {/* Create new */}
          {creating ? (
            <div className="label-form label-form-create">
              <input
                ref={nameInputRef}
                className="label-name-input"
                value={newName}
                onChange={e => setNewName(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') handleCreateLabel(); if (e.key === 'Escape') setCreating(false); }}
                placeholder="Label name (e.g. Bug)"
                maxLength={32}
              />
              <div className="label-color-grid">
                {LABEL_COLOR_PALETTE.map(c => (
                  <button
                    key={c.hex}
                    type="button"
                    className={`label-color-swatch${newColor === c.hex ? ' selected' : ''}`}
                    style={{ background: c.hex }}
                    title={c.name}
                    onClick={() => setNewColor(c.hex)}
                  />
                ))}
              </div>
              <div style={{ display: 'flex', gap: '0.4rem' }}>
                <button className="label-save-btn" onClick={handleCreateLabel} disabled={saving || !newName.trim()}>Create</button>
                <button className="label-cancel-btn" onClick={() => setCreating(false)}>Cancel</button>
              </div>
            </div>
          ) : (
            <button type="button" className="label-create-trigger" onClick={startCreate}>
              ＋ Create new label
            </button>
          )}
        </div>
      )}
    </div>
  );
};
