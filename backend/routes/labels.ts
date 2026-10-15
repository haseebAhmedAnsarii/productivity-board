import { Router } from 'express';
import { db } from '../db.js';
import { authenticateToken, type AuthenticatedRequest } from '../middleware/auth.js';
import { logTaskHistory } from '../services/history.js';

const router = Router();

// --- Board-level label management ---

// GET /api/labels?boardId=X — list all labels for a board
router.get('/', authenticateToken, async (req: AuthenticatedRequest, res) => {
  try {
    const boardId = req.query.boardId as string;
    if (!boardId) return res.status(400).json({ error: 'boardId required' });
    const labels = await db.all(
      'SELECT * FROM labels WHERE board_id = ? ORDER BY name ASC',
      [boardId]
    );
    res.json({ labels });
  } catch (err) {
    console.error('Error fetching labels:', err);
    res.status(500).json({ error: 'Failed to fetch labels' });
  }
});

// POST /api/labels — create a new label on a board
router.post('/', authenticateToken, async (req: AuthenticatedRequest, res) => {
  try {
    const { boardId, name, color } = req.body;
    if (!boardId || !name || !color) return res.status(400).json({ error: 'boardId, name and color required' });
    const result = await db.run(
      'INSERT INTO labels (board_id, name, color) VALUES (?, ?, ?)',
      [boardId, name.trim(), color]
    );
    const label = await db.get('SELECT * FROM labels WHERE id = ?', [result.lastID]);
    res.json({ success: true, label });
  } catch (err) {
    console.error('Error creating label:', err);
    res.status(500).json({ error: 'Failed to create label' });
  }
});

// PUT /api/labels/:id — rename/recolor a label
router.put('/:id', authenticateToken, async (req: AuthenticatedRequest, res) => {
  try {
    const { name, color } = req.body;
    const labelId = req.params.id;
    const existing = await db.get('SELECT * FROM labels WHERE id = ?', [labelId]);
    if (!existing) return res.status(404).json({ error: 'Label not found' });
    await db.run(
      'UPDATE labels SET name = ?, color = ? WHERE id = ?',
      [name?.trim() ?? existing.name, color ?? existing.color, labelId]
    );
    const updated = await db.get('SELECT * FROM labels WHERE id = ?', [labelId]);
    res.json({ success: true, label: updated });
  } catch (err) {
    console.error('Error updating label:', err);
    res.status(500).json({ error: 'Failed to update label' });
  }
});

// DELETE /api/labels/:id — delete a label (cascade removes task_labels rows)
router.delete('/:id', authenticateToken, async (req: AuthenticatedRequest, res) => {
  try {
    const labelId = req.params.id;
    await db.run('DELETE FROM labels WHERE id = ?', [labelId]);
    res.json({ success: true });
  } catch (err) {
    console.error('Error deleting label:', err);
    res.status(500).json({ error: 'Failed to delete label' });
  }
});

// --- Task-level label association ---

// GET /api/labels/task/:taskId — get labels attached to a task
router.get('/task/:taskId', authenticateToken, async (req: AuthenticatedRequest, res) => {
  try {
    const { taskId } = req.params;
    const labels = await db.all(
      `SELECT l.* FROM labels l
       JOIN task_labels tl ON tl.label_id = l.id
       WHERE tl.task_id = ?
       ORDER BY l.name ASC`,
      [taskId]
    );
    res.json({ labels });
  } catch (err) {
    console.error('Error fetching task labels:', err);
    res.status(500).json({ error: 'Failed to fetch task labels' });
  }
});

// POST /api/labels/task/:taskId — set labels for a task (full replace)
router.post('/task/:taskId', authenticateToken, async (req: AuthenticatedRequest, res) => {
  try {
    const taskId = String(req.params.taskId);
    const { labelIds } = req.body as { labelIds: number[] };

    // Fetch existing labels before replacing so we can diff
    const existingLabels = await db.all(
      `SELECT l.id, l.name, l.color FROM labels l
       JOIN task_labels tl ON tl.label_id = l.id
       WHERE tl.task_id = ?`,
      [taskId]
    );

    await db.run('DELETE FROM task_labels WHERE task_id = ?', [taskId]);

    if (labelIds && labelIds.length > 0) {
      const placeholders = labelIds.map(() => '(?, ?)').join(', ');
      const values = labelIds.flatMap(id => [taskId, id]);
      await db.run(
        `INSERT OR IGNORE INTO task_labels (task_id, label_id) VALUES ${placeholders}`,
        values
      );
    }

    // Diff: determine which labels were added and which were removed
    const existingIds = new Set(existingLabels.map((l: { id: number }) => l.id));
    const newIds = new Set(labelIds || []);

    // Log removals
    for (const l of existingLabels as { id: number; name: string; color: string }[]) {
      if (!newIds.has(l.id)) {
        await logTaskHistory(
          taskId,
          req.user?.userId || 0,
          req.user?.username || 'User',
          'label_removed',
          JSON.stringify({ name: l.name, color: l.color }),
          null
        );
      }
    }

    // Log additions — fetch names and colors for added ids
    const addedIds = [...newIds].filter(id => !existingIds.has(id));
    if (addedIds.length > 0) {
      const addedLabels = await db.all(
        `SELECT id, name, color FROM labels WHERE id IN (${addedIds.map(() => '?').join(',')})`,
        addedIds
      );
      for (const l of addedLabels as { id: number; name: string; color: string }[]) {
        await logTaskHistory(
          taskId,
          req.user?.userId || 0,
          req.user?.username || 'User',
          'label_added',
          null,
          JSON.stringify({ name: l.name, color: l.color })
        );
      }
    }

    res.json({ success: true });
  } catch (err) {
    console.error('Error setting task labels:', err);
    res.status(500).json({ error: 'Failed to set task labels' });
  }
});


export default router;
