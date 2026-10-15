import { Router } from 'express';
import authRoutes from './auth.js';
import boardRoutes from './boards.js';
import columnRoutes from './columns.js';
import taskRoutes from './tasks.js';
import labelRoutes from './labels.js';

const apiRouter = Router();

apiRouter.use('/auth', authRoutes);
apiRouter.use('/boards', boardRoutes);
apiRouter.use('/columns', columnRoutes);
apiRouter.use('/tasks', taskRoutes);
apiRouter.use('/labels', labelRoutes);

export default apiRouter;
