import { Router } from 'express';
import { db } from '../db.js';
import { authenticateToken, type AuthenticatedRequest } from '../middleware/auth.js';

const router = Router();

router.get('/', authenticateToken, async (req: AuthenticatedRequest, res) => {
  try {
    const userId = req.user?.userId;
    const board = await db.get('SELECT * FROM boards WHERE user_id = ? LIMIT 1', [userId]);
    if (!board) return res.json({ columns: [], deletedTasks: [] });

    const columns = await db.all(
      'SELECT * FROM columns WHERE board_id = ? AND (is_deleted = 0 OR is_deleted IS NULL) ORDER BY order_index ASC',
      [board.id]
    );

    const activeTasks = await db.all(`
      SELECT tasks.* FROM tasks 
      JOIN columns ON tasks.column_id = columns.id 
      WHERE columns.board_id = ? AND (columns.is_deleted = 0 OR columns.is_deleted IS NULL) AND (tasks.is_deleted = 0 OR tasks.is_deleted IS NULL)
      ORDER BY tasks.order_index ASC
    `, [board.id]);
    
    const deletedTasks = await db.all(`
      SELECT * FROM tasks 
      WHERE (board_id = ? OR column_id IN (SELECT id FROM columns WHERE board_id = ?))
      AND is_deleted = 1
      ORDER BY id DESC
    `, [board.id, board.id]);

    const groupedColumns = columns.map(col => ({
      id: col.id.toString(),
      title: col.title,
      tasks: activeTasks.filter(t => t.column_id === col.id).map(t => ({
        id: t.id.toString(),
        title: t.title,
        description: t.description
      }))
    }));

    const allBoardColumns = await db.all('SELECT id, title FROM columns WHERE board_id = ?', [board.id]);
    const colTitleMap = new Map(allBoardColumns.map(c => [c.id, c.title]));

    const formattedDeletedTasks = deletedTasks.map(t => ({
      id: t.id.toString(),
      title: t.title,
      description: t.description,
      originalColumnId: t.original_column_id ? t.original_column_id.toString() : null,
      originalColumnTitle: t.original_column_id ? (colTitleMap.get(t.original_column_id) || null) : null
    }));
    
    res.json({ 
      boardId: board.id.toString(), 
      name: board.name, 
      columns: groupedColumns,
      deletedTasks: formattedDeletedTasks
    });
  } catch (err) {
    console.error('Error fetching board:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
