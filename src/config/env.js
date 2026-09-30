// All configuration comes from environment variables; nothing is read from committed files.
export const config = {
  env: process.env.NODE_ENV ?? 'development',
  port: Number(process.env.PORT ?? 3000),
  databaseUrl: process.env.DATABASE_URL ?? '',
  sessionSecret: process.env.SESSION_SECRET ?? '',
};
