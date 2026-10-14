import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { db } from '../db.js';
import { JWT_SECRET } from '../config.js';

const router = Router();

router.post('/register', async (req, res) => {
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
    await db.run('INSERT INTO columns (board_id, title, order_index) VALUES (?, ?, ?)', [boardId, 'In Progress', 1]);
    await db.run('INSERT INTO columns (board_id, title, order_index) VALUES (?, ?, ?)', [boardId, 'Done', 2]);
    
    // Seed default task
    await db.run('INSERT INTO tasks (column_id, title, description, order_index) VALUES (?, ?, ?, ?)', [c1.lastID, 'Welcome!', 'Drag me around.', 0]);

    res.json({ success: true, message: 'User registered successfully.' });
  } catch (err: any) {
    if (err.message && err.message.includes('UNIQUE constraint failed')) {
      return res.status(400).json({ error: 'Username already exists' });
    }
    res.status(500).json({ error: 'Server error' });
  }
});

router.post('/login', async (req, res) => {
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

export default router;
