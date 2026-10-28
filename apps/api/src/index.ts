import { app } from './app.js';
import { env } from './config/env.js';
import { runMigrations } from './db/migrate.js';
import { checkDatabaseHealth } from './db/index.js';

async function bootstrap() {
  console.log(`[GeoMonitor API] Initializing server in ${env.NODE_ENV} mode...`);

  // Verify database connection and auto-run migrations in development
  const dbHealth = await checkDatabaseHealth();
  if (dbHealth.ok) {
    console.log(`[PostGIS] Connected! PostGIS Version: ${dbHealth.postgisVersion}`);
    try {
      await runMigrations();
    } catch (err) {
      console.warn('[Migration Warning] Schema migration encountered an error, continuing:', err);
    }
  } else {
    console.warn(`[Database Warning] Could not connect to PostgreSQL: ${dbHealth.error}`);
  }

  const server = app.listen(env.PORT, () => {
    console.log(`====================================================`);
    console.log(`🚀 GeoMonitor 3D API Server is running!`);
    console.log(`📡 URL: http://localhost:${env.PORT}/api/v1`);
    console.log(`📑 Swagger Documentation: http://localhost:${env.PORT}/api-docs`);
    console.log(`🩺 Health Check: http://localhost:${env.PORT}/api/v1/health`);
    console.log(`====================================================`);
  });

  const shutdown = async () => {
    console.log('[GeoMonitor API] Shutting down gracefully...');
    server.close(() => {
      console.log('[GeoMonitor API] HTTP server closed.');
      process.exit(0);
    });
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

bootstrap().catch((err) => {
  console.error('[GeoMonitor API] Fatal bootstrap error:', err);
  process.exit(1);
});
