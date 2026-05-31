import { Router, Request, Response } from 'express';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import OpenAI from 'openai';

const router = Router();

// Queries with cosine similarity >= this threshold are deflected automatically.
const DEFLECTION_THRESHOLD = 0.82;

// Must match the vector(1536) column in handbook_knowledge_embeddings.
const EMBEDDING_MODEL = 'text-embedding-ada-002';

// ── OpenAI singleton ─────────────────────────────────────────
let _openai: OpenAI | null = null;

function openaiClient(): OpenAI {
  if (_openai) return _openai;
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error('OPENAI_API_KEY must be set.');
  _openai = new OpenAI({ apiKey });
  return _openai;
}

// ── Supabase admin singleton ─────────────────────────────────
let _supabase: SupabaseClient | null = null;

function supabase(): SupabaseClient {
  if (_supabase) return _supabase;
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set.');
  }
  _supabase = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return _supabase;
}

// ── Types ────────────────────────────────────────────────────

interface QueryRequestBody {
  query: string;
  studentId: string;
  category?: string;
}

interface HandbookMatch {
  id: string;
  source_document: string;
  content: string;
  metadata: Record<string, unknown>;
  similarity: number;
}

// ── Helpers ──────────────────────────────────────────────────

async function embedQuery(text: string): Promise<number[]> {
  const response = await openaiClient().embeddings.create({
    model: EMBEDDING_MODEL,
    input: text,
  });
  return response.data[0].embedding;
}

// Calls the match_handbook_embeddings() RPC which uses cosine distance (<=>).
// threshold=0 so we always get the best match back regardless of score —
// the deflection decision is made in application code.
async function findBestHandbookMatch(
  queryEmbedding: number[],
): Promise<HandbookMatch | null> {
  const { data, error } = await supabase().rpc('match_handbook_embeddings', {
    query_embedding: queryEmbedding,
    match_threshold: 0,
    match_count: 1,
  });

  if (error) throw error;
  return (data as HandbookMatch[])?.[0] ?? null;
}

async function escalateToTicket(
  studentId: string,
  query: string,
  category: string,
): Promise<{ id: string; status: string; created_at: string }> {
  const { data, error } = await supabase()
    .from('advising_ticket_pipeline')
    .insert({
      student_id: studentId,
      category,
      priority: 'medium',
      status: 'open',
      description: query,
      file_attachment_urls: [],
    })
    .select('id, status, created_at')
    .single();

  if (error) throw error;
  return data;
}

// ── POST /api/ai/query ───────────────────────────────────────
//
// Flow:
//   1. Embed the incoming query with text-embedding-ada-002.
//   2. Search handbook_knowledge_embeddings via cosine distance (RPC).
//   3. similarity >= 0.82  → deflect: return automated answer, isDeflected=true.
//   4. similarity <  0.82  → escalate: insert advising ticket, isDeflected=false.

router.post('/query', async (req: Request, res: Response): Promise<void> => {
  const { query, studentId, category = 'general_inquiry' } =
    req.body as QueryRequestBody;

  if (!query?.trim()) {
    res.status(400).json({ error: 'query is required.' });
    return;
  }
  if (!studentId) {
    res.status(400).json({ error: 'studentId is required.' });
    return;
  }

  const normalizedQuery = query.trim();

  try {
    // Step 1 — embed the query
    const queryEmbedding = await embedQuery(normalizedQuery);

    // Step 2 — cosine similarity search against the handbook
    const match = await findBestHandbookMatch(queryEmbedding);
    const similarity = match?.similarity ?? 0;

    // Step 3 — deflect: handbook contains a sufficiently similar answer
    if (similarity >= DEFLECTION_THRESHOLD) {
      res.json({
        isDeflected: true,
        similarity,
        answer: match!.content,
        source: match!.source_document,
        metadata: match!.metadata,
      });
      return;
    }

    // Step 4 — escalate: no confident match; open a live advising ticket
    const ticket = await escalateToTicket(studentId, normalizedQuery, category);

    res.status(201).json({
      isDeflected: false,
      similarity,
      ticket,
      message:
        'No handbook match met the confidence threshold. Your query has been escalated to a live advising ticket.',
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    res.status(500).json({ error: 'AI query processing failed.', detail: message });
  }
});

export default router;
