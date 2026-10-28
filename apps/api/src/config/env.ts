import dotenv from 'dotenv';
import path from 'path';
import { z } from 'zod';

// Load root .env or local .env
dotenv.config({ path: path.resolve(process.cwd(), '../../.env') });
dotenv.config({ path: path.resolve(process.cwd(), '.env') });
dotenv.config();

const EnvSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().default(4000),
  API_BASE_URL: z.string().default('http://localhost:4000/api/v1'),
  WEB_BASE_URL: z.string().default('http://localhost:3000'),

  JWT_SECRET: z.string().default('super-secret-geomonitor-key-change-in-production-min32chars'),
  JWT_ACCESS_EXPIRES_IN: z.string().default('1h'),
  JWT_REFRESH_EXPIRES_IN: z.string().default('7d'),
  COOKIE_SECRET: z.string().default('geomonitor-secure-cookie-secret-key-32chars'),

  DB_HOST: z.string().default('localhost'),
  DB_PORT: z.coerce.number().default(5432),
  DB_USER: z.string().default('geomonitor'),
  DB_PASSWORD: z.string().default('geomonitor_secret'),
  DB_NAME: z.string().default('geomonitor'),
  DATABASE_URL: z
    .string()
    .default('postgresql://geomonitor:geomonitor_secret@localhost:5432/geomonitor'),

  REDIS_HOST: z.string().default('localhost'),
  REDIS_PORT: z.coerce.number().default(6379),
  REDIS_PASSWORD: z.string().optional().default(''),

  MINIO_ENDPOINT: z.string().default('localhost'),
  MINIO_PORT: z.coerce.number().default(9000),
  MINIO_USE_SSL: z.coerce.boolean().default(false),
  MINIO_ROOT_USER: z.string().default('minioadmin'),
  MINIO_ROOT_PASSWORD: z.string().default('minioadmin'),
  MINIO_BUCKET_ASSETS: z.string().default('geomonitor-assets'),
  MINIO_BUCKET_REPORTS: z.string().default('geomonitor-reports'),
  STORAGE_LOCAL_DIR: z.string().default(path.resolve(__dirname, '../../storage')),
});

export const env = EnvSchema.parse(process.env);
