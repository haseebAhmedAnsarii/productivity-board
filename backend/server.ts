import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import dotenv from 'dotenv';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { db, initDb } from './db.js';

dotenv.config();

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: { origin: '*' }
});

app.use(cors());
app.use(express.json());

const JWT_SECRET = process.env.JWT_SECRET || 'super_secret_key_change_me';

// --- AUTHENTICATION ROUTES ---

app.post('/api/auth/register', async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) return res.status(400).json({ error: 'Username and password required' });

    const passwordHash = await bcrypt.hash(password, 10);
    const result = await db.run('INSERT INTO users (username, password_hash) VALUES (?, ?)', [username, passwordHash]);
    
    // Create a default board for the new user automatically
    const boardResult = await db.run('INSERT INTO boards (user_id, name) VALUES (?, ?)', [result.lastID, `${username}'s Board`]);
    const boardId = boardResult.lastID;
    
    // Seed default columns
    const c1 = await db.run('INSERT INTO columns (board_id, title, order_index) VALUES (?, ?, ?)', [boardId, 'To Do', 0]);
    const c2 = await db.run('INSERT INTO columns (board_id, title, order_index) VALUES (?, ?, ?)', [boardId, 'In Progress', 1]);
    const c3 = await db.run('INSERT INTO columns (board_id, title, order_index) VALUES (?, ?, ?)', [boardId, 'Done', 2]);
    
    // Seed default task
    await db.run('INSERT INTO tasks (column_id, title, description, order_index) VALUES (?, ?, ?, ?)', [c1.lastID, 'Welcome!', 'Drag me around.', 0]);

    res.json({ success: true, message: 'User registered successfully.' });
  } catch (err: any) {
    if (err.message.includes('UNIQUE constraint failed')) {
      return res.status(400).json({ error: 'Username already exists' });
    }
    res.status(500).json({ error: 'Server error' });
  }
});

app.post('/api/auth/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    const user = await db.get('SELECT * FROM users WHERE username = ?', [username]);
    
    if (!user || !(await bcrypt.compare(password, user.password_hash))) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const token = jwt.sign({ userId: user.id, username: user.username }, JWT_SECRET, { expiresIn: '24h' });
    res.json({ token, username, userId: user.id });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// --- MIDDLEWARE ---
const authenticateToken = (req: any, res: any, next: any) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  
  if (!token) return res.sendStatus(401);
  
  jwt.verify(token, JWT_SECRET, (err: any, user: any) => {
    if (err) return res.sendStatus(403);
    req.user = user;
    next();
  });
};

// --- TASK HISTORY LOGGING HELPER ---
const logTaskHistory = async (taskId: number | string, userId: number | string, username: string, changeType: string, oldValue: string | null = null, newValue: string | null = null) => {
  try {
    const nowIso = new Date().toISOString();
    await db.run(
      'INSERT INTO task_history (task_id, user_id, username, change_type, old_value, new_value, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [parseInt(taskId.toString()), parseInt(userId.toString()), username, changeType, oldValue, newValue, nowIso]
    );
  } catch (err) {
    console.error('Error logging task history:', err);
  }
};

// --- PROTECTED API ROUTES ---

app.get('/api/boards', authenticateToken, async (req: any, res: any) => {
  try {
    const userId = req.user.userId;
    const board = await db.get('SELECT * FROM boards WHERE user_id = ? LIMIT 1', [userId]);
    if (!board) return res.json({ columns: [], deletedTasks: [] });

    const columns = await db.all('SELECT * FROM columns WHERE board_id = ? AND (is_deleted = 0 OR is_deleted IS NULL) ORDER BY order_index ASC', [board.id]);
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
        id: t.id.toString(), title: t.title, description: t.description
      }))
    }));

    const formattedDeletedTasks = deletedTasks.map(t => ({
      id: t.id.toString(),
      title: t.title,
      description: t.description,
      originalColumnId: t.original_column_id ? t.original_column_id.toString() : null
    }));
    
    res.json({ 
      boardId: board.id.toString(), 
      name: board.name, 
      columns: groupedColumns,
      deletedTasks: formattedDeletedTasks
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});


app.post('/api/tasks', authenticateToken, async (req: any, res: any) => {
  try {
    const { columnId, title, description } = req.body;
    const col = await db.get('SELECT board_id FROM columns WHERE id = ?', [columnId]);
    const boardId = col ? col.board_id : null;

    const maxOrderRes = await db.get('SELECT MAX(order_index) as maxOrder FROM tasks WHERE column_id = ? AND (is_deleted = 0 OR is_deleted IS NULL)', [columnId]);
    const nextOrder = (maxOrderRes?.maxOrder ?? -1) + 1;
    
    const result = await db.run(
      'INSERT INTO tasks (column_id, board_id, title, description, order_index, is_deleted) VALUES (?, ?, ?, ?, ?, 0)', 
      [columnId, boardId, title, description, nextOrder]
    );
    await logTaskHistory(result.lastID!, req.user.userId, req.user.username, 'created', null, title);
    res.json({ success: true, taskId: result.lastID });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to create task' });
  }
});


app.delete('/api/tasks/:id', authenticateToken, async (req: any, res: any) => {
  try {
    const task = await db.get('SELECT * FROM tasks WHERE id = ?', [req.params.id]);
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
    `, [boardId, req.params.id]);

    await logTaskHistory(req.params.id, req.user.userId, req.user.username, 'deleted', colTitle, 'Moved to Deleted');
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to delete task' });
  }
});

app.post('/api/tasks/:id/restore', authenticateToken, async (req: any, res: any) => {
  try {
    const task = await db.get('SELECT * FROM tasks WHERE id = ?', [req.params.id]);
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
    `, [targetColumnId, nextOrder, req.params.id]);

    await logTaskHistory(req.params.id, req.user.userId, req.user.username, 'restored', 'Deleted', targetColTitle);
    res.json({ success: true, columnId: targetColumnId, columnTitle: targetColTitle });
  } catch (err) {
    console.error('Error restoring task:', err);
    res.status(500).json({ error: 'Failed to restore task' });
  }
});


app.post('/api/columns', authenticateToken, async (req: any, res: any) => {
  try {
    const { boardId, title } = req.body;
    if (!title || !title.trim()) {
      return res.status(400).json({ error: 'Column title is required' });
    }
    if (!boardId) {
      return res.status(400).json({ error: 'Board ID is required' });
    }

    const board = await db.get('SELECT * FROM boards WHERE id = ? AND user_id = ?', [boardId, req.user.userId]);
    if (!board) {
      return res.status(404).json({ error: 'Board not found' });
    }

    const maxOrderRes = await db.get('SELECT MAX(order_index) as maxOrder FROM columns WHERE board_id = ? AND (is_deleted = 0 OR is_deleted IS NULL)', [boardId]);
    const nextOrder = (maxOrderRes?.maxOrder ?? -1) + 1;

    const result = await db.run('INSERT INTO columns (board_id, title, order_index, is_deleted) VALUES (?, ?, ?, 0)', [boardId, title.trim(), nextOrder]);
    res.json({ success: true, columnId: result.lastID, title: title.trim(), order_index: nextOrder });
  } catch (err) {
    console.error('Error creating column:', err);
    res.status(500).json({ error: 'Failed to create column' });
  }
});

app.delete('/api/columns/:id', authenticateToken, async (req: any, res: any) => {
  try {
    const column = await db.get(`
      SELECT columns.* FROM columns 
      JOIN boards ON columns.board_id = boards.id 
      WHERE columns.id = ? AND boards.user_id = ?
    `, [req.params.id, req.user.userId]);

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
        req.user.userId, 
        req.user.username, 
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

app.put('/api/tasks/:id', authenticateToken, async (req: any, res: any) => {
  try {
    const task = await db.get('SELECT * FROM tasks WHERE id = ?', [req.params.id]);
    if (!task) return res.status(404).json({ error: 'Task not found' });
    if (task.is_deleted === 1) {
      return res.status(400).json({ error: 'Deleted tasks cannot be edited' });
    }
    const { title, description, columnId } = req.body;

    const newTitle = title !== undefined ? title : task.title;
    const newDescription = description !== undefined ? description : task.description;

    if (newTitle && task.title !== newTitle) {
      await logTaskHistory(req.params.id, req.user.userId, req.user.username, 'title', task.title, newTitle);
    }
    if ((task.description || '') !== (newDescription || '')) {
      await logTaskHistory(req.params.id, req.user.userId, req.user.username, 'description', task.description || '(empty)', newDescription || '(empty)');
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
          req.params.id,
          req.user.userId,
          req.user.username,
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
      'UPDATE tasks SET title = ?, description = ?, column_id = ?, order_index = ? WHERE id = ?',
      [newTitle, newDescription, targetColumnId, targetOrder, req.params.id]
    );

    res.json({ success: true, columnId: targetColumnId });
  } catch (err) {
    res.status(500).json({ error: 'Failed to update task' });
  }
});

app.get('/api/tasks/:id/history', authenticateToken, async (req: any, res: any) => {
  try {
    const history = await db.all(
      'SELECT * FROM task_history WHERE task_id = ? ORDER BY id DESC',
      [req.params.id]
    );
    res.json({ history });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch task history' });
  }
});

io.use((socket: any, next) => {
  const token = socket.handshake.auth.token;
  if (!token) return next(new Error('Authentication error'));
  
  jwt.verify(token, JWT_SECRET, (err: any, decoded: any) => {
    if (err) return next(new Error('Authentication error'));
    socket.user = decoded;
    next();
  });
});

io.on('connection', (socket: any) => {
  socket.on('join_board', (boardId: string) => {
    socket.join(`board_${boardId}`);
  });

  socket.on('move_task', async (data: any) => {
    try {
      socket.to(`board_${data.boardId}`).emit('task_moved', data);
      
      if (data.sourceColumnId !== data.destinationColumnId) {
        const sourceCol = await db.get('SELECT title FROM columns WHERE id = ?', [data.sourceColumnId]);
        const destCol = await db.get('SELECT title FROM columns WHERE id = ?', [data.destinationColumnId]);
        if (sourceCol && destCol) {
          await logTaskHistory(data.taskId, socket.user?.userId || 0, socket.user?.username || 'User', 'moved', sourceCol.title, destCol.title);
        }
      }

      await db.run('UPDATE tasks SET order_index = order_index + 1 WHERE column_id = ? AND order_index >= ?', [parseInt(data.destinationColumnId), data.destinationIndex]);
      await db.run('UPDATE tasks SET column_id = ?, order_index = ? WHERE id = ?', [parseInt(data.destinationColumnId), data.destinationIndex, parseInt(data.taskId)]);
      await db.run('UPDATE tasks SET order_index = order_index - 1 WHERE column_id = ? AND order_index > ?', [parseInt(data.sourceColumnId), data.sourceIndex]);
    } catch (err) {
      console.error(err);
    }
  });
  
  socket.on('column_updated', (data: any) => {
    socket.to(`board_${data.boardId}`).emit('task_updated');
  });

  socket.on('task_updated', (data: any) => {
    socket.to(`board_${data.boardId}`).emit('task_updated');
  });

  socket.on('disconnect', () => {
    console.log('User disconnected:', socket.id);
  });
});

const PORT = process.env.PORT || 4000;
const startServer = async () => {
  try {
    await initDb();
    httpServer.listen(PORT, () => console.log(`Backend server running on http://localhost:${PORT}`));
  } catch (error) {
    console.error("Failed to start server", error);
  }
};
startServer();