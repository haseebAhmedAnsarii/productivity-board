import { Router } from 'express';
import { db } from '../db.js';
import { authenticateToken, type AuthenticatedRequest } from '../middleware/auth.js';
import { logTaskHistory } from '../services/history.js';

const router = Router();

// Create new task
router.post('/', authenticateToken, async (req: AuthenticatedRequest, res) => {
  try {
    const { columnId, title, description, priority, dueDate } = req.body;
    const col = await db.get('SELECT board_id FROM columns WHERE id = ?', [columnId]);
    const boardId = col ? col.board_id : null;

    const maxOrderRes = await db.get(
      'SELECT MAX(order_index) as maxOrder FROM tasks WHERE column_id = ? AND (is_deleted = 0 OR is_deleted IS NULL)',
      [columnId]
    );
    const nextOrder = (maxOrderRes?.maxOrder ?? -1) + 1;
    const rawPriority = priority === 'urgent' ? 'critical' : priority;
    const taskPriority = rawPriority || 'medium';
    const taskDueDate = dueDate || null;
    
    const result = await db.run(
      'INSERT INTO tasks (column_id, board_id, title, description, order_index, is_deleted, priority, due_date) VALUES (?, ?, ?, ?, ?, 0, ?, ?)', 
      [columnId, boardId, title, description, nextOrder, taskPriority, taskDueDate]
    );
    await logTaskHistory(result.lastID!, req.user?.userId || 0, req.user?.username || 'User', 'created', null, title);
    res.json({ success: true, taskId: result.lastID });
  } catch (err) {
    console.error('Error creating task:', err);
    res.status(500).json({ error: 'Failed to create task' });
  }
});

// Soft-delete task
router.delete('/:id', authenticateToken, async (req: AuthenticatedRequest, res) => {
  try {
    const taskId = req.params.id as string;
    const task = await db.get('SELECT * FROM tasks WHERE id = ?', [taskId]);
    if (!task) return res.status(404).json({ error: 'Task not found' });

    let boardId = task.board_id;
    let colTitle: string | null = null;
    if (task.column_id) {
      const col = await db.get('SELECT board_id, title FROM columns WHERE id = ?', [task.column_id]);
      if (col) {
        boardId = col.board_id;
        colTitle = col.title;
      }
    }

    await db.run(`
      UPDATE tasks 
      SET is_deleted = 1, 
          original_column_id = column_id,
          board_id = ?,
          column_id = NULL
      WHERE id = ?
    `, [boardId, taskId]);

    await logTaskHistory(taskId, req.user?.userId || 0, req.user?.username || 'User', 'deleted', colTitle, 'Moved to Deleted');
    res.json({ success: true });
  } catch (err) {
    console.error('Error deleting task:', err);
    res.status(500).json({ error: 'Failed to delete task' });
  }
});

// Restore task
router.post('/:id/restore', authenticateToken, async (req: AuthenticatedRequest, res) => {
  try {
    const taskId = req.params.id as string;
    const task = await db.get('SELECT * FROM tasks WHERE id = ?', [taskId]);
    if (!task) return res.status(404).json({ error: 'Task not found' });

    const { targetColumnId: requestedColId } = req.body || {};
    let targetColumnId: number | null = null;
    let targetColTitle: string = 'Active Board';

    // 0. If target column was explicitly requested by user (e.g. from modal Move To dropdown)
    if (requestedColId) {
      const explicitCol = await db.get(
        'SELECT * FROM columns WHERE id = ? AND board_id = ? AND (is_deleted = 0 OR is_deleted IS NULL)',
        [requestedColId, task.board_id]
      );
      if (explicitCol) {
        targetColumnId = explicitCol.id;
        targetColTitle = explicitCol.title;
      }
    }

    // 1. Check if original_column_id points to an existing column in DB
    if (!targetColumnId && task.original_column_id) {
      const origCol = await db.get('SELECT * FROM columns WHERE id = ?', [task.original_column_id]);
      if (origCol) {
        if (origCol.is_deleted === 1) {
          // Column was deleted: check if an active column with the exact same title exists on this board
          const duplicateActiveCol = await db.get(
            'SELECT * FROM columns WHERE board_id = ? AND title = ? AND (is_deleted = 0 OR is_deleted IS NULL) AND id != ?',
            [task.board_id, origCol.title, origCol.id]
          );

          if (duplicateActiveCol) {
            targetColumnId = duplicateActiveCol.id;
            targetColTitle = duplicateActiveCol.title;
          } else {
            // Restore the original column back to the active board
            await db.run('UPDATE columns SET is_deleted = 0 WHERE id = ?', [origCol.id]);
            targetColumnId = origCol.id;
            targetColTitle = origCol.title;
          }
        } else {
          // Column is already active
          targetColumnId = origCol.id;
          targetColTitle = origCol.title;
        }
      }
    }

    // 2. If targetColumnId still not resolved (e.g. column was hard-deleted before soft-delete was introduced)
    if (!targetColumnId) {
      const lastDeleteHistory = await db.get(`
        SELECT old_value FROM task_history 
        WHERE task_id = ? AND change_type = 'deleted' AND old_value IS NOT NULL 
        ORDER BY id DESC LIMIT 1
      `, [task.id]);

      const originalName = lastDeleteHistory?.old_value;

      if (originalName) {
        // Check if an active column with this title already exists on the board
        const existingCol = await db.get(
          'SELECT * FROM columns WHERE board_id = ? AND title = ? AND (is_deleted = 0 OR is_deleted IS NULL)',
          [task.board_id, originalName]
        );

        if (existingCol) {
          targetColumnId = existingCol.id;
          targetColTitle = existingCol.title;
        } else {
          // Re-create the original column so the card returns to its original column
          const maxOrderRes = await db.get(
            'SELECT MAX(order_index) as maxOrder FROM columns WHERE board_id = ? AND (is_deleted = 0 OR is_deleted IS NULL)',
            [task.board_id]
          );
          const nextColOrder = (maxOrderRes?.maxOrder ?? -1) + 1;
          const newCol = await db.run(
            'INSERT INTO columns (board_id, title, order_index, is_deleted) VALUES (?, ?, ?, 0)',
            [task.board_id, originalName, nextColOrder]
          );
          targetColumnId = newCol.lastID!;
          targetColTitle = originalName;
        }
      }
    }

    // 3. Fallback: if no original column information exists anywhere, restore to first column
    if (!targetColumnId) {
      const firstCol = await db.get(
        'SELECT * FROM columns WHERE board_id = ? AND (is_deleted = 0 OR is_deleted IS NULL) ORDER BY order_index ASC LIMIT 1',
        [task.board_id]
      );
      if (!firstCol) {
        return res.status(400).json({ error: 'No column available to restore this task to. Please create a column first.' });
      }
      targetColumnId = firstCol.id;
      targetColTitle = firstCol.title;
    }

    const maxOrderRes = await db.get(
      'SELECT MAX(order_index) as maxOrder FROM tasks WHERE column_id = ? AND (is_deleted = 0 OR is_deleted IS NULL)',
      [targetColumnId]
    );
    const nextOrder = (maxOrderRes?.maxOrder ?? -1) + 1;

    await db.run(`
      UPDATE tasks 
      SET is_deleted = 0, 
          column_id = ?, 
          order_index = ? 
      WHERE id = ?
    `, [targetColumnId, nextOrder, taskId]);

    await logTaskHistory(taskId, req.user?.userId || 0, req.user?.username || 'User', 'restored', 'Deleted', targetColTitle);
    res.json({ success: true, columnId: targetColumnId, columnTitle: targetColTitle });
  } catch (err) {
    console.error('Error restoring task:', err);
    res.status(500).json({ error: 'Failed to restore task' });
  }
});

// Update task details (title, description, columnId move)
router.put('/:id', authenticateToken, async (req: AuthenticatedRequest, res) => {
  try {
    const taskId = req.params.id as string;
    const task = await db.get('SELECT * FROM tasks WHERE id = ?', [taskId]);
    if (!task) return res.status(404).json({ error: 'Task not found' });
    if (task.is_deleted === 1) {
      return res.status(400).json({ error: 'Deleted tasks cannot be edited' });
    }
    const { title, description, columnId, priority, dueDate } = req.body;

    const newTitle = title !== undefined ? title : task.title;
    const newDescription = description !== undefined ? description : task.description;
    const rawPriority = priority === 'urgent' ? 'critical' : priority;
    const currentPriority = (task.priority === 'urgent' ? 'critical' : task.priority) || 'medium';
    const newPriority = rawPriority !== undefined ? rawPriority : currentPriority;
    const newDueDate = dueDate !== undefined ? (dueDate || null) : (task.due_date || null);

    if (newTitle && task.title !== newTitle) {
      await logTaskHistory(taskId, req.user?.userId || 0, req.user?.username || 'User', 'title', task.title, newTitle);
    }
    if ((task.description || '') !== (newDescription || '')) {
      await logTaskHistory(taskId, req.user?.userId || 0, req.user?.username || 'User', 'description', task.description || '(empty)', newDescription || '(empty)');
    }
    if ((task.priority || 'medium') !== newPriority) {
      await logTaskHistory(taskId, req.user?.userId || 0, req.user?.username || 'User', 'priority', task.priority || 'medium', newPriority);
    }
    if ((task.due_date || null) !== newDueDate) {
      await logTaskHistory(taskId, req.user?.userId || 0, req.user?.username || 'User', 'due_date', task.due_date || 'No Date', newDueDate || 'No Date');
    }

    let targetColumnId = task.column_id;
    let targetOrder = task.order_index;

    if (columnId && parseInt(columnId.toString()) !== task.column_id) {
      const targetCol = await db.get(
        'SELECT * FROM columns WHERE id = ? AND board_id = ? AND (is_deleted = 0 OR is_deleted IS NULL)',
        [columnId, task.board_id]
      );
      if (targetCol) {
        const sourceCol = await db.get('SELECT title FROM columns WHERE id = ?', [task.column_id]);
        await logTaskHistory(
          taskId,
          req.user?.userId || 0,
          req.user?.username || 'User',
          'moved',
          sourceCol?.title || 'Previous Column',
          targetCol.title
        );

        targetColumnId = targetCol.id;
        const maxOrderRes = await db.get(
          'SELECT MAX(order_index) as maxOrder FROM tasks WHERE column_id = ? AND (is_deleted = 0 OR is_deleted IS NULL)',
          [targetColumnId]
        );
        targetOrder = (maxOrderRes?.maxOrder ?? -1) + 1;
      }
    }

    await db.run(
      'UPDATE tasks SET title = ?, description = ?, column_id = ?, order_index = ?, priority = ?, due_date = ? WHERE id = ?',
      [newTitle, newDescription, targetColumnId, targetOrder, newPriority, newDueDate, taskId]
    );

    res.json({ success: true, columnId: targetColumnId });
  } catch (err) {
    console.error('Error updating task:', err);
    res.status(500).json({ error: 'Failed to update task' });
  }
});

// Fetch task history
router.get('/:id/history', authenticateToken, async (req: AuthenticatedRequest, res) => {
  try {
    const taskId = req.params.id as string;
    const history = await db.all(
      'SELECT * FROM task_history WHERE task_id = ? ORDER BY id DESC',
      [taskId]
    );
    res.json({ history });
  } catch (err) {
    console.error('Error fetching task history:', err);
    res.status(500).json({ error: 'Failed to fetch task history' });
  }
});

export default router;
