import { Router } from 'express';

/** Health probe used by Render and the keep-alive ping (RSK-001). Touches the DB so it also warms Neon. */
export function healthRouter(pool) {
  const r = Router();
  r.get('/healthz', async (_req, res) => {
    try {
      await pool.query('SELECT 1');
      res.json({ status: 'ok' });
    } catch {
      res.status(503).json({ status: 'database-unavailable' });
    }
  });
  return r;
}
