-- ============================================================
-- RPC: match_handbook_embeddings
-- Cosine similarity search over handbook_knowledge_embeddings.
-- Called by the AI controller via supabase.rpc().
--
-- Cosine distance (<=>): 0 = identical, 2 = opposite.
-- Similarity = 1 - distance, so higher is better.
-- ============================================================

CREATE OR REPLACE FUNCTION match_handbook_embeddings(
  query_embedding  vector(1536),
  match_threshold  float8,
  match_count      int
)
RETURNS TABLE (
  id               uuid,
  source_document  text,
  content          text,
  metadata         jsonb,
  similarity       float8
)
LANGUAGE sql STABLE AS $$
  SELECT
    id,
    source_document,
    content,
    metadata,
    1 - (embedding <=> query_embedding) AS similarity
  FROM handbook_knowledge_embeddings
  WHERE state = 'active'
    AND 1 - (embedding <=> query_embedding) >= match_threshold
  ORDER BY embedding <=> query_embedding
  LIMIT match_count;
$$;
