import { Router, Request, Response } from 'express';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

const router = Router();

// ── Triangular Distribution constants (minutes) ──────────────
// E(T) = (a + b + c) / 3  →  (5 + 45 + 15) / 3 = 21.667 min
const EXEC_A = 5;   // optimistic
const EXEC_B = 45;  // pessimistic
const EXEC_C = 15;  // most likely
const E = (EXEC_A + EXEC_B + EXEC_C) / 3;

// Ticket statuses that are still in flight (unresolved).
const UNRESOLVED_STATUSES = ['open', 'in_progress', 'pending_review'] as const;

// ── Admin client singleton ───────────────────────────────────
let _client: SupabaseClient | null = null;

function supabase(): SupabaseClient {
  if (_client) return _client;
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set.');
  }
  _client = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return _client;
}

// ── GET /api/queue/metrics/:student_id ───────────────────────
//
// Little's Law:  W = L / λ
//   L      — current number of unresolved tickets in the system
//   λ      — arrival rate: tickets opened in the last 24 hours
//   W      — expected system wait (in the same time unit as λ, i.e. "per day")
//
// Triangular Distribution expected value:
//   E      — (a + b + c) / 3  where a=5 b=45 c=15  → 21.667 min per ticket
//
// dynamicCountdownMinutes = E × studentQueuePosition

router.get('/metrics/:student_id', async (req: Request, res: Response): Promise<void> => {
  const { student_id } = req.params;

  try {
    // ── L: all in-flight tickets, ordered oldest-first for position ranking ──
    const { data: unresolvedTickets, error: unresolvedErr } = await supabase()
      .from('advising_ticket_pipeline')
      .select('id, student_id, created_at')
      .in('status', UNRESOLVED_STATUSES)
      .order('created_at', { ascending: true });

    if (unresolvedErr) throw unresolvedErr;

    const L = unresolvedTickets?.length ?? 0;

    // ── λ: ticket arrivals over the past 24 hours ────────────
    const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

    const { count: rawLambda, error: lambdaErr } = await supabase()
      .from('advising_ticket_pipeline')
      .select('id', { count: 'exact', head: true })
      .gte('created_at', since24h);

    if (lambdaErr) throw lambdaErr;

    const Lambda = rawLambda ?? 0;

    // ── W = L / λ  (Little's Law) ────────────────────────────
    // null when no arrivals in 24 h (undefined rate → undefined wait).
    const W = Lambda > 0 ? L / Lambda : null;

    // ── Student queue position ───────────────────────────────
    // Position = 1-based rank of the student's earliest unresolved ticket
    // among all unresolved tickets sorted by created_at ascending.
    const studentTickets = (unresolvedTickets ?? []).filter(
      (t) => t.student_id === student_id,
    );

    let studentQueuePosition: number | null = null;

    if (studentTickets.length > 0) {
      // unresolvedTickets is already sorted asc; find the first match.
      const globalIdx = unresolvedTickets!.findIndex(
        (t) => t.id === studentTickets[0].id,
      );
      studentQueuePosition = globalIdx + 1; // convert to 1-based
    }

    // ── dynamicCountdownMinutes = E × position ───────────────
    const dynamicCountdownMinutes =
      studentQueuePosition !== null
        ? Math.round(E * studentQueuePosition)
        : null;

    res.json({
      studentId: student_id,
      queueMetrics: {
        L,
        Lambda,
        W,
      },
      executionModel: {
        a: EXEC_A,
        b: EXEC_B,
        c: EXEC_C,
        E: parseFloat(E.toFixed(4)),
      },
      studentQueuePosition,
      dynamicCountdownMinutes,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    res.status(500).json({ error: 'Failed to compute queue metrics.', detail: message });
  }
});

export default router;
