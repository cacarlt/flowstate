import express from 'express';
import cors from 'cors';
import { projectsRouter } from './routes/projects';
import { todosRouter } from './routes/todos';
import { adoRouter } from './routes/ado';
import { sessionsRouter } from './routes/sessions';
import { configRouter } from './routes/config';
import { mydayRouter } from './routes/myday';
import { githubRouter } from './routes/github';
import { metricsMiddleware, metricsHandler } from './metrics';

export function createApp() {
  const app = express();
  app.use(cors());
  app.use(express.json());
  app.use(metricsMiddleware);

  app.get('/metrics', metricsHandler);
  app.use('/api/config', configRouter);
  app.use('/api/myday', mydayRouter);
  app.use('/api/projects', projectsRouter);
  app.use('/api/todos', todosRouter);
  app.use('/api/ado', adoRouter);
  app.use('/api/github', githubRouter);
  app.use('/api/sessions', sessionsRouter);

  return app;
}
