import express from 'express';
import { healthRouter } from './routes/health.js';
import { DomainError } from './errors.js';

export function createApp({ pool }) {
  const app = express();
  app.disable('x-powered-by');
  app.use(express.json());
  app.use(healthRouter(pool));
  // Feature routers (requests, staff queue, reports) are mounted here as they are built (M2/M3).

  app.use((err, _req, res, _next) => {
    if (err instanceof DomainError)
      return res.status(err.httpStatus).json({ error: err.code, message: err.message });
    console.error(err);
    return res.status(500).json({ error: 'INTERNAL' });
  });
  return app;
}
