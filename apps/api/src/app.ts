import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import morgan from 'morgan';
import swaggerUi from 'swagger-ui-express';
import { env } from './config/env.js';
import { openApiSpec } from './swagger/openapi.js';
import { healthRouter } from './modules/health/health.router.js';
import { authRouter } from './modules/auth/auth.router.js';
import { areasRouter } from './modules/areas/areas.router.js';
import { surveysRouter } from './modules/surveys/surveys.router.js';
import { changeRouter } from './modules/change-analysis/change.router.js';
import { reportsRouter } from './modules/reports/reports.router.js';
import { dashboardRouter } from './modules/dashboard/dashboard.router.js';
import { projectsRouter } from './modules/projects/projects.router.js';
import { auditRouter } from './modules/audit/audit.router.js';
import { teamsRouter } from './modules/teams/teams.router.js';
import { locationsRouter } from './modules/team-locations/locations.router.js';
import { layersRouter } from './modules/map-layers/layers.router.js';
import { symbolsRouter } from './modules/symbols/symbols.router.js';
import { simulationsRouter } from './modules/simulations/simulations.router.js';
import { locationUpdatesRouter } from './modules/location-updates/updates.router.js';
import { missionsRouter } from './modules/drone-missions/missions.router.js';
import { errorHandler } from './middlewares/errorHandler.js';

export const app = express();

// Security & Parsing Middlewares
app.use(
  helmet({
    contentSecurityPolicy: false,
    crossOriginEmbedderPolicy: false,
  })
);

app.use(
  cors({
    origin: [env.WEB_BASE_URL, 'http://localhost:3000', 'http://127.0.0.1:3000'],
    credentials: true,
  })
);

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));
app.use(cookieParser(env.COOKIE_SECRET));

if (env.NODE_ENV !== 'test') {
  app.use(morgan('dev'));
}

// Swagger / OpenAPI documentation
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(openApiSpec));

// Static files for local uploaded drone deliverables & mock 3D tiles
app.use('/storage', express.static(env.STORAGE_LOCAL_DIR));

// Mount API v1 Routers
app.use('/api/v1', healthRouter);
app.use('/api/v1', authRouter);
app.use('/api/v1', areasRouter);
app.use('/api/v1', surveysRouter);
app.use('/api/v1', changeRouter);
app.use('/api/v1', reportsRouter);
app.use('/api/v1', dashboardRouter);
app.use('/api/v1', projectsRouter);
app.use('/api/v1', auditRouter);
app.use('/api/v1', teamsRouter);
app.use('/api/v1', locationsRouter);
app.use('/api/v1', layersRouter);
app.use('/api/v1', symbolsRouter);
app.use('/api/v1', simulationsRouter);
app.use('/api/v1', locationUpdatesRouter);
app.use('/api/v1', missionsRouter);


// 404 handler for undefined API routes
app.use('/api/v1/*', (req, res) => {
  res.status(404).json({
    success: false,
    error: {
      code: 'NOT_FOUND',
      message: `ไม่พบเส้นทาง API: ${req.method} ${req.originalUrl}`,
    },
  });
});

// Global Error Handler
app.use(errorHandler);
