-- ============================================================
-- Migration 031: On-chain milestone arbitration (issue #1082)
-- ============================================================
-- Off-chain read model for the milestone_arbitration Soroban contract. The
-- chain is the source of truth for every state transition; these tables
-- exist so the UI (open disputes, a juror's assignments, a dispute detail
-- page) can be served from Postgres instead of replaying events on every
-- request. Rows are written by the event indexer as it observes
-- DisputeOpened / VoteCommitted / VoteRevealed / DisputeResolved events, not
-- by any direct user-facing write path.

CREATE TABLE IF NOT EXISTS disputes (
    dispute_id          BIGINT PRIMARY KEY,
    proposal_id         INTEGER NOT NULL,
    milestone_id        INTEGER NOT NULL,
    scholar_address      TEXT NOT NULL,
    evidence_ipfs_cid    TEXT,
    evidence_hash        TEXT NOT NULL,
    scholar_stake        NUMERIC NOT NULL,
    opened_at            TIMESTAMP WITH TIME ZONE NOT NULL,
    commit_deadline      TIMESTAMP WITH TIME ZONE NOT NULL,
    reveal_deadline      TIMESTAMP WITH TIME ZONE NOT NULL,
    phase                TEXT NOT NULL DEFAULT 'active'
                             CHECK (phase IN ('active', 'resolved', 'quorum_failed')),
    votes_for            INTEGER NOT NULL DEFAULT 0,
    votes_against        INTEGER NOT NULL DEFAULT 0,
    revealed_count       INTEGER NOT NULL DEFAULT 0,
    outcome              BOOLEAN,
    resolved_at          TIMESTAMP WITH TIME ZONE,
    resolve_tx_hash       TEXT,
    open_tx_hash          TEXT,
    created_at           TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at           TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (proposal_id, milestone_id)
);

CREATE INDEX IF NOT EXISTS idx_disputes_phase ON disputes (phase);
CREATE INDEX IF NOT EXISTS idx_disputes_scholar_address ON disputes (scholar_address);
CREATE INDEX IF NOT EXISTS idx_disputes_reveal_deadline ON disputes (reveal_deadline);

-- One row per juror drawn onto a dispute's panel. Populated from the panel
-- list carried on the DisputeOpened event.
CREATE TABLE IF NOT EXISTS dispute_jurors (
    id             SERIAL PRIMARY KEY,
    dispute_id     BIGINT NOT NULL REFERENCES disputes (dispute_id),
    juror_address  TEXT NOT NULL,
    has_committed  BOOLEAN NOT NULL DEFAULT FALSE,
    has_revealed   BOOLEAN NOT NULL DEFAULT FALSE,
    created_at     TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (dispute_id, juror_address)
);

CREATE INDEX IF NOT EXISTS idx_dispute_jurors_juror_address ON dispute_jurors (juror_address);
CREATE INDEX IF NOT EXISTS idx_dispute_jurors_dispute_id ON dispute_jurors (dispute_id);

-- Vote reveals only -- commitments are opaque hashes with no informational
-- value off-chain, so only VoteRevealed events produce a row here. The
-- dispute_jurors.has_committed flag is the off-chain signal for "committed
-- but reveal is still pending."
CREATE TABLE IF NOT EXISTS dispute_votes (
    id            SERIAL PRIMARY KEY,
    dispute_id    BIGINT NOT NULL REFERENCES disputes (dispute_id),
    juror_address TEXT NOT NULL,
    vote          BOOLEAN NOT NULL,
    revealed_at   TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    tx_hash       TEXT,
    UNIQUE (dispute_id, juror_address)
);

CREATE INDEX IF NOT EXISTS idx_dispute_votes_dispute_id ON dispute_votes (dispute_id);

-- A scholar uploads evidence to IPFS and registers its CID here *before*
-- signing the on-chain `open_dispute` call (which only ever receives the
-- hash). The indexer attaches this CID to the `disputes` row once it
-- observes the matching DisputeOpened event, keyed by (proposal_id,
-- milestone_id) since the dispute id isn't known client-side beforehand.
CREATE TABLE IF NOT EXISTS pending_dispute_evidence (
    proposal_id       INTEGER NOT NULL,
    milestone_id      INTEGER NOT NULL,
    scholar_address   TEXT NOT NULL,
    evidence_ipfs_cid TEXT NOT NULL,
    created_at        TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (proposal_id, milestone_id)
);

-- New notification types for the dispute lifecycle (see notifications-store.ts).
ALTER TABLE notification_preferences
    ADD COLUMN IF NOT EXISTS dispute_opened BOOLEAN NOT NULL DEFAULT TRUE,
    ADD COLUMN IF NOT EXISTS dispute_juror_selected BOOLEAN NOT NULL DEFAULT TRUE,
    ADD COLUMN IF NOT EXISTS dispute_reveal_reminder BOOLEAN NOT NULL DEFAULT TRUE,
    ADD COLUMN IF NOT EXISTS dispute_resolved BOOLEAN NOT NULL DEFAULT TRUE;
