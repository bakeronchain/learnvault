-- IPFS upload registry
-- Tracks every file pinned to IPFS so admins can audit uploads and so the
-- frontend can list attachments for a given proposal or course.
CREATE TABLE IF NOT EXISTS ipfs_uploads (
    id              SERIAL PRIMARY KEY,
    uploader_address TEXT NOT NULL,
    cid             TEXT NOT NULL UNIQUE,
    gateway_url     TEXT NOT NULL,
    original_filename TEXT NOT NULL,
    mimetype        TEXT NOT NULL,
    -- Loose tag for the call-site: 'proposal_document' | 'course_cover' |
    -- 'milestone_evidence' | 'nft_image' | 'nft_metadata'
    context         TEXT,
    -- Optional foreign-key hints (nullable; not all uploads are tied to a row)
    ref_id          TEXT,   -- e.g. proposal on-chain ID or course ID
    created_at      TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Course assets — stores the IPFS CID for each course's cover image so the
-- courses controller can serve it alongside the course metadata.
CREATE TABLE IF NOT EXISTS course_assets (
    course_id       TEXT NOT NULL,
    asset_type      TEXT NOT NULL DEFAULT 'cover_image',
    cid             TEXT NOT NULL,
    gateway_url     TEXT NOT NULL,
    uploaded_by     TEXT NOT NULL,
    created_at      TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (course_id, asset_type)
);

-- Proposal documents — stores off-chain CIDs for supporting documents
-- attached to on-chain scholarship proposals.
CREATE TABLE IF NOT EXISTS proposal_documents (
    id              SERIAL PRIMARY KEY,
    proposal_id     TEXT NOT NULL,   -- on-chain proposal identifier
    uploader_address TEXT NOT NULL,
    cid             TEXT NOT NULL,
    gateway_url     TEXT NOT NULL,
    original_filename TEXT NOT NULL,
    created_at      TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_proposal_documents_proposal_id
    ON proposal_documents (proposal_id);
