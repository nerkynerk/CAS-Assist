import express, { Request, Response, NextFunction } from 'express';
import { authenticateJWT } from './middleware/auth';
import queueRouter from './controllers/queueController';
import aiRouter from './controllers/aiController';

const app = express();
const PORT = process.env.PORT ?? 4000;

app.use(express.json());

// ── Health check (unauthenticated) ───────────────────────────
app.get('/health', (_req: Request, res: Response) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// ── Protected API routes ─────────────────────────────────────
// authenticateJWT runs first on every /api route; individual
// controllers call enforceRBAC as needed on specific endpoints.
app.use('/api/queue', authenticateJWT, queueRouter);
app.use('/api/ai',    authenticateJWT, aiRouter);

// ── 404 handler ──────────────────────────────────────────────
app.use((_req: Request, res: Response) => {
  res.status(404).json({ error: 'Route not found.' });
});

// ── Global error handler ─────────────────────────────────────
app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
  const message = err instanceof Error ? err.message : 'Internal server error.';
  res.status(500).json({ error: message });
});

app.listen(PORT, () => {
  console.log(`CAS-Assist backend listening on port ${PORT}`);
});

export default app;
