import { Server, Socket } from 'socket.io';
import jwt from 'jsonwebtoken';
import { JWT_SECRET } from '../config.js';
import { db } from '../db.js';
import { logTaskHistory } from '../services/history.js';

interface AuthenticatedSocket extends Socket {
  user?: {
    userId: number;
    username: string;
  };
}

export const setupBoardSockets = (io: Server) => {
  // Authentication middleware for Socket.IO connections
  io.use((socket: AuthenticatedSocket, next) => {
    const token = socket.handshake.auth.token;
    if (!token) return next(new Error('Authentication error'));
    
    jwt.verify(token, JWT_SECRET, (err: any, decoded: any) => {
      if (err) return next(new Error('Authentication error'));
      socket.user = decoded;
      next();
    });
  });

  io.on('connection', (socket: AuthenticatedSocket) => {
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
            await logTaskHistory(
              data.taskId, 
              socket.user?.userId || 0, 
              socket.user?.username || 'User', 
              'moved', 
              sourceCol.title, 
              destCol.title
            );
          }
        }

        await db.run(
          'UPDATE tasks SET order_index = order_index + 1 WHERE column_id = ? AND order_index >= ?',
          [parseInt(data.destinationColumnId), data.destinationIndex]
        );
        await db.run(
          'UPDATE tasks SET column_id = ?, order_index = ? WHERE id = ?',
          [parseInt(data.destinationColumnId), data.destinationIndex, parseInt(data.taskId)]
        );
        await db.run(
          'UPDATE tasks SET order_index = order_index - 1 WHERE column_id = ? AND order_index > ?',
          [parseInt(data.sourceColumnId), data.sourceIndex]
        );
      } catch (err) {
        console.error('Error handling move_task event:', err);
      }
    });
    
    socket.on('column_updated', (data: any) => {
      socket.to(`board_${data.boardId}`).emit('task_updated');
    });

    socket.on('task_updated', (data: any) => {
      socket.to(`board_${data.boardId}`).emit('task_updated');
    });

    socket.on('disconnect', () => {
      // client disconnected
    });
  });
};
