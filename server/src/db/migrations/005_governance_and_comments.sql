-- ============================================================
-- Migration 005: Governance proposals, comments, and scholar balances
-- ============================================================

CREATE TABLE IF NOT EXISTS comments (
    id             SERIAL PRIMARY KEY,
    proposal_id    TEXT NOT NULL,
    author_address TEXT NOT NULL,
    parent_id      INTEGER REFERENCES comments(id) ON DELETE CASCADE,
    content        TEXT NOT NULL,
    upvotes        INTEGER DEFAULT 0,
    downvotes      INTEGER DEFAULT 0,
    is_pinned      BOOLEAN DEFAULT FALSE,
    created_at     TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    deleted_at     TIMESTAMP WITH TIME ZONE
);

CREATE TABLE IF NOT EXISTS comment_votes (
    id             SERIAL PRIMARY KEY,
    comment_id     INTEGER REFERENCES comments(id) ON DELETE CASCADE,
    voter_address  TEXT NOT NULL,
    vote_type      TEXT CHECK (vote_type IN ('upvote', 'downvote')),
    UNIQUE(comment_id, voter_address)
);

CREATE TABLE IF NOT EXISTS proposals (
    id             SERIAL PRIMARY KEY,
    author_address TEXT NOT NULL,
    title          TEXT NOT NULL,
    description    TEXT NOT NULL,
    amount         NUMERIC(18, 7) NOT NULL DEFAULT 0,
    votes_for      BIGINT NOT NULL DEFAULT 0,
    votes_against  BIGINT NOT NULL DEFAULT 0,
    status         TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
    deadline       TIMESTAMP WITH TIME ZONE,
    created_at     TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_proposals_status_created_at
    ON proposals (status, created_at DESC);

CREATE TABLE IF NOT EXISTS scholar_balances (
    address           TEXT PRIMARY KEY,
    lrn_balance       NUMERIC(30, 0) NOT NULL DEFAULT 0,
    courses_completed INTEGER NOT NULL DEFAULT 0,
    updated_at        TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_scholar_balances_lrn_desc
    ON scholar_balances (lrn_balance DESC, address ASC);
