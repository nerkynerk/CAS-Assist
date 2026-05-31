import express, {
  type Request,
  type Response,
  type NextFunction,
} from 'express';
import cors from 'cors';

import { authenticateJWT } from './middleware/auth';
import queueRouter from './controllers/queueController';
import aiRouter    from './controllers/aiController';

// ─────────────────────────────────────────────────────────────
// App configuration
// ─────────────────────────────────────────────────────────────

const PORT = Number(process.env.PORT ?? 5000);
const ENV  = process.env.NODE_ENV ?? 'development';

const app = express();

// ── CORS ─────────────────────────────────────────────────────
// Restrict origins in production via CORS_ORIGIN env var.
// Falls back to permissive '*' in development.
app.use(
  cors({
    origin: process.env.CORS_ORIGIN ?? '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Authorization', 'Content-Type'],
  }),
);

// ── Body parsing ─────────────────────────────────────────────
app.use(express.json({ limit: '1mb' }));

// ── Request logger ───────────────────────────────────────────
app.use((req: Request, _res: Response, next: NextFunction) => {
  const ts = new Date().toISOString();
  console.log(`  ${ts}  ${req.method.padEnd(7)} ${req.path}`);
  next();
});

// ─────────────────────────────────────────────────────────────
// Routes
// ─────────────────────────────────────────────────────────────

// Health check — unauthenticated, used by load balancers / CI
app.get('/health', (_req: Request, res: Response) => {
  res.json({ status: 'ok', env: ENV, timestamp: new Date().toISOString() });
});

// Authenticated API surface
// authenticateJWT validates the Bearer token on every /api/* request.
// enforceRBAC is applied per-endpoint inside each controller.
app.use('/api/queue', authenticateJWT, queueRouter);
app.use('/api/ai',    authenticateJWT, aiRouter);

// ─────────────────────────────────────────────────────────────
// Error handling
// ─────────────────────────────────────────────────────────────

app.use((_req: Request, res: Response) => {
  res.status(404).json({ error: 'Route not found.' });
});

// Express requires 4-argument signature to recognise an error handler.
// eslint-disable-next-line @typescript-eslint/no-unused-vars
app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
  const message = err instanceof Error ? err.message : 'Internal server error.';
  console.error('[error]', message);
  res.status(500).json({ error: message });
});

// ─────────────────────────────────────────────────────────────
// Boot
// ─────────────────────────────────────────────────────────────

const ROUTES = [
  { method: 'GET',  path: '/health' },
  { method: 'GET',  path: '/api/queue/metrics/:student_id' },
  { method: 'POST', path: '/api/ai/query' },
] as const;

function printBanner(startedAt: string) {
  const line   = '─'.repeat(48);
  const pad    = (label: string, value: string) =>
    `│  ${label.padEnd(14)} ${value.padEnd(29)} │`;

  console.log(`┌${line}┐`);
  console.log(`│${'  CAS-Assist  API  Server'.padStart(35).padEnd(48)}│`);
  console.log(`├${line}┤`);
  console.log(pad('Environment', ENV));
  console.log(pad('Port',        String(PORT)));
  console.log(pad('Started',     startedAt));
  console.log(`├${line}┤`);
  console.log(`│  ${'Registered routes'.padEnd(46)}│`);
  for (const r of ROUTES) {
    console.log(`│    ${r.method.padEnd(6)} ${r.path.padEnd(40)}│`);
  }
  console.log(`└${line}┘`);
}

const server = app.listen(PORT, () => {
  printBanner(new Date().toISOString());
});

// ─────────────────────────────────────────────────────────────
// Graceful shutdown
// ─────────────────────────────────────────────────────────────

function shutdown(signal: string) {
  console.log(`\n[server] ${signal} received — shutting down gracefully.`);
  server.close(() => {
    console.log('[server] All connections closed. Exiting.');
    process.exit(0);
  });
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT',  () => shutdown('SIGINT'));

export default app;
