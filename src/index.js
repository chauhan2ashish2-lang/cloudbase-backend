import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { env } from './config/env.js';
import { autoMigrate } from './config/autoMigrate.js';

import authRoutes from './routes/auth.routes.js';
import metaRoutes from './routes/meta.routes.js';
import contentRoutes from './routes/content.routes.js';
import businessesRoutes from './routes/businesses.routes.js';
// import adsRoutes from './routes/ads.routes.js';
// import analyticsRoutes from './routes/analytics.routes.js';
import agentsRoutes from './routes/agents.routes.js';
import adsRoutes from './routes/ads.routes.js';
// import billingRoutes from './routes/billing.routes.js';

const app = express();

// Render (and most PaaS platforms) sit behind a reverse proxy that sets
// X-Forwarded-For. Without this, express-rate-limit throws a validation
// error on every request since it can't safely trust the client IP.
app.set('trust proxy', 1);

app.use(helmet());
app.use(cors({ origin: env.frontendUrl, credentials: true }));

// Capture raw body for Meta webhook signature verification, JSON-parse everywhere else.
app.use(
  express.json({
    verify: (req, res, buf) => {
      req.rawBody = buf;
    },
  })
);

app.use(
  rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 300,
    standardHeaders: true,
  })
);

app.get('/health', (req, res) => res.json({ status: 'ok', env: env.nodeEnv }));

const v1 = express.Router();
v1.use('/auth', authRoutes);
v1.use('/meta', metaRoutes);
v1.use('/', contentRoutes); // content.routes.js defines full paths incl. /businesses/:id/...
v1.use('/', businessesRoutes);
// v1.use('/', adsRoutes);
// v1.use('/', analyticsRoutes);
v1.use('/', agentsRoutes);
v1.use('/', adsRoutes);
// v1.use('/billing', billingRoutes);

app.use('/api/v1', v1);

// Centralized error handler
app.use((err, req, res, next) => {
  console.error(err);
  if (err.name === 'ZodError') {
    return res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'Invalid request', details: err.errors } });
  }
  res.status(err.status || 500).json({
    error: { code: err.code || 'INTERNAL_ERROR', message: err.message || 'Something went wrong' },
  });
});

app.listen(env.port, async () => {
  console.log(`AI Marketing Manager API listening on :${env.port} [${env.nodeEnv}]`);
  try {
    await autoMigrate();
  } catch (err) {
    console.error('[migrate] Failed to auto-migrate schema:', err.message);
  }
});
