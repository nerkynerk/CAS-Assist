-- ============================================================
-- CAS-Assist Core Schema
-- Migration: 20260601000000_cas_assist_core
-- ============================================================

-- ── Extensions ──────────────────────────────────────────────
CREATE EXTENSION IF NOT EXISTS vector;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ── ENUM types ──────────────────────────────────────────────
CREATE TYPE rbac_role_tier AS ENUM (
    'student',
    'faculty',
    'staff',
    'super_admin'
);

CREATE TYPE lifecycle_state AS ENUM (
    'active',
    'archived_read_only'
);

CREATE TYPE ticket_priority AS ENUM (
    'low',
    'medium',
    'high',
    'urgent'
);

CREATE TYPE ticket_status AS ENUM (
    'open',
    'in_progress',
    'pending_review',
    'resolved',
    'closed'
);

-- ── users_account_registry ───────────────────────────────────
-- Central identity table. All users must have a @neu.edu.ph email.
CREATE TABLE users_account_registry (
    id                  UUID            PRIMARY KEY DEFAULT uuid_generate_v4(),
    email               TEXT            NOT NULL UNIQUE,
    display_name        TEXT            NOT NULL,
    role                rbac_role_tier  NOT NULL DEFAULT 'student',
    state               lifecycle_state NOT NULL DEFAULT 'active',
    created_at          TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ     NOT NULL DEFAULT NOW(),

    CONSTRAINT chk_neu_email CHECK (email LIKE '%@neu.edu.ph')
);

CREATE INDEX idx_users_email   ON users_account_registry (email);
CREATE INDEX idx_users_role    ON users_account_registry (role);
CREATE INDEX idx_users_state   ON users_account_registry (state);

-- ── advising_ticket_pipeline ─────────────────────────────────
-- Tracks student advising requests from submission through resolution.
CREATE TABLE advising_ticket_pipeline (
    id                  UUID            PRIMARY KEY DEFAULT uuid_generate_v4(),
    student_id          UUID            NOT NULL REFERENCES users_account_registry (id) ON DELETE RESTRICT,
    assigned_to         UUID            REFERENCES users_account_registry (id) ON DELETE SET NULL,
    category            TEXT            NOT NULL,
    priority            ticket_priority NOT NULL DEFAULT 'medium',
    status              ticket_status   NOT NULL DEFAULT 'open',
    description         TEXT            NOT NULL,
    file_attachment_urls TEXT[]         NOT NULL DEFAULT '{}',
    state               lifecycle_state NOT NULL DEFAULT 'active',
    resolved_at         TIMESTAMPTZ,
    created_at          TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ     NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_ticket_student    ON advising_ticket_pipeline (student_id);
CREATE INDEX idx_ticket_assigned   ON advising_ticket_pipeline (assigned_to);
CREATE INDEX idx_ticket_status     ON advising_ticket_pipeline (status);
CREATE INDEX idx_ticket_priority   ON advising_ticket_pipeline (priority);
CREATE INDEX idx_ticket_created    ON advising_ticket_pipeline (created_at DESC);

-- ── spatial_logs ─────────────────────────────────────────────
-- Real-time classroom relocation event log.
CREATE TABLE spatial_logs (
    id                  UUID            PRIMARY KEY DEFAULT uuid_generate_v4(),
    logged_by           UUID            NOT NULL REFERENCES users_account_registry (id) ON DELETE RESTRICT,
    original_room       TEXT            NOT NULL,
    relocated_room      TEXT            NOT NULL,
    subject_code        TEXT,
    section             TEXT,
    reason              TEXT,
    effective_at        TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    expires_at          TIMESTAMPTZ,
    created_at          TIMESTAMPTZ     NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_spatial_logged_by    ON spatial_logs (logged_by);
CREATE INDEX idx_spatial_effective    ON spatial_logs (effective_at DESC);
CREATE INDEX idx_spatial_orig_room    ON spatial_logs (original_room);
CREATE INDEX idx_spatial_new_room     ON spatial_logs (relocated_room);

-- ── handbook_knowledge_embeddings ────────────────────────────
-- Stores chunked handbook content with OpenAI-compatible 1536-dim embeddings
-- for semantic search / RAG retrieval.
CREATE TABLE handbook_knowledge_embeddings (
    id                  UUID            PRIMARY KEY DEFAULT uuid_generate_v4(),
    source_document     TEXT            NOT NULL,
    chunk_index         INTEGER         NOT NULL,
    content             TEXT            NOT NULL,
    embedding           vector(1536)    NOT NULL,
    metadata            JSONB           NOT NULL DEFAULT '{}',
    state               lifecycle_state NOT NULL DEFAULT 'active',
    created_at          TIMESTAMPTZ     NOT NULL DEFAULT NOW(),

    UNIQUE (source_document, chunk_index)
);

-- HNSW index for fast approximate nearest-neighbour search (cosine similarity).
CREATE INDEX idx_handbook_embedding_hnsw
    ON handbook_knowledge_embeddings
    USING hnsw (embedding vector_cosine_ops)
    WITH (m = 16, ef_construction = 64);

CREATE INDEX idx_handbook_source   ON handbook_knowledge_embeddings (source_document);
CREATE INDEX idx_handbook_state    ON handbook_knowledge_embeddings (state);

-- ── updated_at auto-maintenance ──────────────────────────────
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$;

CREATE TRIGGER trg_users_updated_at
    BEFORE UPDATE ON users_account_registry
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_ticket_updated_at
    BEFORE UPDATE ON advising_ticket_pipeline
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();
