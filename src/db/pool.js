import pg from 'pg';
import { config } from '../config/env.js';

export function createPool(connectionString = config.databaseUrl) {
  if (!connectionString) throw new Error('DATABASE_URL is not set (see .env.example)');
  return new pg.Pool({
    connectionString,
    max: 5, // small: Neon free tier has limited connections; use the -pooler host in production
    idleTimeoutMillis: 10_000,
  });
}
