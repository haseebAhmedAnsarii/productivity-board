import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';

import { PORT } from './config.js';
import { initDb } from './db.js';
import apiRouter from './routes/index.js';
import { setupBoardSockets } from './sockets/boardSocket.js';

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: { origin: '*' }
});

app.use(cors());
app.use(express.json());

// Mount all API routes under /api
app.use('/api', apiRouter);

// Setup Socket.IO realtime connection & board events
setupBoardSockets(io);

const startServer = async () => {
  try {
    await initDb();
    httpServer.listen(PORT, () => console.log(`Backend server running on http://localhost:${PORT}`));
  } catch (error) {
    console.error("Failed to start server", error);
  }
};

startServer();