import { Router } from 'express';
import { db } from '../db.js';
import { authenticateToken, type AuthenticatedRequest } from '../middleware/auth.js';
import { logTaskHistory } from '../services/history.js';

const router = Router();

router.post('/', authenticateToken, async (req: AuthenticatedRequest, res) => {
  try {
    const { boardId, title } = req.body;
    if (!title || !title.trim()) {
      return res.status(400).json({ error: 'Column title is required' });
    }
    if (!boardId) {
      return res.status(400).json({ error: 'Board ID is required' });
    }

    const board = await db.get('SELECT * FROM boards WHERE id = ? AND user_id = ?', [boardId, req.user?.userId]);
    if (!board) {
      return res.status(404).json({ error: 'Board not found' });
    }

    const maxOrderRes = await db.get(
      'SELECT MAX(order_index) as maxOrder FROM columns WHERE board_id = ? AND (is_deleted = 0 OR is_deleted IS NULL)',
      [boardId]
    );
    const nextOrder = (maxOrderRes?.maxOrder ?? -1) + 1;

    const result = await db.run(
      'INSERT INTO columns (board_id, title, order_index, is_deleted) VALUES (?, ?, ?, 0)',
      [boardId, title.trim(), nextOrder]
    );
    res.json({ success: true, columnId: result.lastID, title: title.trim(), order_index: nextOrder });
  } catch (err) {
    console.error('Error creating column:', err);
    res.status(500).json({ error: 'Failed to create column' });
  }
});

router.delete('/:id', authenticateToken, async (req: AuthenticatedRequest, res) => {
  try {
    const column = await db.get(`
      SELECT columns.* FROM columns 
      JOIN boards ON columns.board_id = boards.id 
      WHERE columns.id = ? AND boards.user_id = ?
    `, [req.params.id, req.user?.userId]);

    if (!column) {
      return res.status(404).json({ error: 'Column not found' });
    }

    // Find all active tasks in this column before moving them
    const tasksInColumn = await db.all(`
      SELECT id FROM tasks 
      WHERE column_id = ? AND (is_deleted = 0 OR is_deleted IS NULL)
    `, [req.params.id]);

    // Move all active tasks in this column to Deleted
    await db.run(`
      UPDATE tasks 
      SET is_deleted = 1, 
          original_column_id = ?, 
          board_id = ?, 
          column_id = NULL 
      WHERE column_id = ?
    `, [req.params.id, column.board_id, req.params.id]);

    // Log history for every task moved to Deleted due to column deletion
    for (const t of tasksInColumn) {
      await logTaskHistory(
        t.id, 
        req.user?.userId || 0, 
        req.user?.username || 'User', 
        'deleted', 
        column.title, 
        `Column "${column.title}" was deleted`
      );
    }

    // Safely soft-delete the column record so it can be restored when its cards are restored
    await db.run('UPDATE columns SET is_deleted = 1 WHERE id = ?', [req.params.id]);
    res.json({ success: true, affectedTasks: tasksInColumn.length });
  } catch (err) {
    console.error('Error deleting column:', err);
    res.status(500).json({ error: 'Failed to delete column' });
  }
});

export default router;
