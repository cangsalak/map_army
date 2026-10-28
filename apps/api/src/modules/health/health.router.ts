import { Router, Request, Response } from 'express';
import Redis from 'ioredis';
import { checkDatabaseHealth } from '../../db/index.js';
import { env } from '../../config/env.js';

export const healthRouter = Router();

healthRouter.get('/health', async (req: Request, res: Response) => {
  const startTime = Date.now();

  // Check Database + PostGIS
  const dbHealth = await checkDatabaseHealth();

  // Check Redis
  let redisOk = false;
  let redisError: string | undefined;
  try {
    const redisClient = new Redis({
      host: env.REDIS_HOST,
      port: env.REDIS_PORT,
      password: env.REDIS_PASSWORD || undefined,
      connectTimeout: 2000,
      lazyConnect: true,
      maxRetriesPerRequest: 1,
    });
    await redisClient.connect();
    const pingRes = await redisClient.ping();
    redisOk = pingRes === 'PONG';
    await redisClient.quit();
  } catch (err: any) {
    redisOk = false;
    redisError = err.message;
  }

  const allHealthy = dbHealth.ok && redisOk;
  const latencyMs = Date.now() - startTime;

  const responsePayload = {
    status: allHealthy ? 'healthy' : 'degraded',
    system: 'GeoMonitor 3D API Service',
    version: '1.0.0',
    timestamp: new Date().toISOString(),
    latencyMs,
    services: {
      database: {
        status: dbHealth.ok ? 'connected' : 'disconnected',
        type: 'PostgreSQL 16 + PostGIS',
        postgisVersion: dbHealth.postgisVersion,
        error: dbHealth.error,
      },
      redis: {
        status: redisOk ? 'connected' : 'disconnected',
        host: `${env.REDIS_HOST}:${env.REDIS_PORT}`,
        error: redisError,
      },
      objectStorage: {
        status: 'configured',
        provider: 'MinIO / S3 Compatible & Local Storage Fallback',
        buckets: [env.MINIO_BUCKET_ASSETS, env.MINIO_BUCKET_REPORTS],
      },
    },
  };

  return res.status(allHealthy ? 200 : 503).json(responsePayload);
});
