import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import dotenv from 'dotenv';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { db, initDb } from './db';

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

// --- PROTECTED API ROUTES ---

app.get('/api/boards', authenticateToken, async (req: any, res: any) => {
  try {
    const userId = req.user.userId;
    const board = await db.get('SELECT * FROM boards WHERE user_id = ? LIMIT 1', [userId]);
    if (!board) return res.json({ columns: [] });

    const columns = await db.all('SELECT * FROM columns WHERE board_id = ? ORDER BY order_index ASC', [board.id]);
    const tasks = await db.all(`
      SELECT tasks.* FROM tasks 
      JOIN columns ON tasks.column_id = columns.id 
      WHERE columns.board_id = ? 
      ORDER BY tasks.order_index ASC
    `, [board.id]);
    
    const groupedColumns = columns.map(col => ({
      id: col.id.toString(),
      title: col.title,
      tasks: tasks.filter(t => t.column_id === col.id).map(t => ({
        id: t.id.toString(), title: t.title, description: t.description
      }))
    }));
    
    res.json({ boardId: board.id.toString(), name: board.name, columns: groupedColumns });
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});


app.post('/api/tasks', authenticateToken, async (req: any, res: any) => {
  try {
    const { columnId, title, description } = req.body;
    const maxOrderRes = await db.get('SELECT MAX(order_index) as maxOrder FROM tasks WHERE column_id = ?', [columnId]);
    const nextOrder = (maxOrderRes?.maxOrder ?? -1) + 1;
    
    const result = await db.run('INSERT INTO tasks (column_id, title, description, order_index) VALUES (?, ?, ?, ?)', [columnId, title, description, nextOrder]);
    res.json({ success: true, taskId: result.lastID });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to create task' });
  }
});


app.delete('/api/tasks/:id', authenticateToken, async (req: any, res: any) => {
  try {
    await db.run('DELETE FROM tasks WHERE id = ?', [req.params.id]);
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to delete task' });
  }
});

app.put('/api/tasks/:id', authenticateToken, async (req: any, res: any) => {
  try {
    const { title, description } = req.body;
    await db.run('UPDATE tasks SET title = ?, description = ? WHERE id = ?', [title, description, req.params.id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to update task' });
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
      
      await db.run('UPDATE tasks SET order_index = order_index + 1 WHERE column_id = ? AND order_index >= ?', [parseInt(data.destinationColumnId), data.destinationIndex]);
      await db.run('UPDATE tasks SET column_id = ?, order_index = ? WHERE id = ?', [parseInt(data.destinationColumnId), data.destinationIndex, parseInt(data.taskId)]);
      await db.run('UPDATE tasks SET order_index = order_index - 1 WHERE column_id = ? AND order_index > ?', [parseInt(data.sourceColumnId), data.sourceIndex]);
    } catch (err) {
      console.error(err);
    }
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