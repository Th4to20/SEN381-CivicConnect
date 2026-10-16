import { config } from './config/env.js';
import { createPool } from './db/pool.js';
import { createApp } from './app.js';
import { createEventBus, EVENTS } from './events/eventBus.js';

const pool = createPool();
const events = createEventBus();
// Placeholder consumer: FR-005 is in-platform status visibility (M1 scope), so for now we only log.
events.on(EVENTS.STATUS_CHANGED, (e) =>
  console.log(`[status] request ${e.requestId}: ${e.from} -> ${e.to}`),
);

createApp({ pool, events }).listen(config.port, () =>
  console.log(`CivicConnect listening on :${config.port}`),
);
