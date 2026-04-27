-- ============================================================
-- Migration 005: ScholarNFT credentials table
-- ============================================================

-- ScholarNFT table: stores minted ScholarNFT credentials
CREATE TABLE IF NOT EXISTS scholar_nfts (
    token_id BIGINT PRIMARY KEY,
    scholar_address TEXT NOT NULL,
    course_id TEXT NOT NULL,
    metadata_uri TEXT NOT NULL,
    minted_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    revoked BOOLEAN NOT NULL DEFAULT FALSE,
    revoked_reason TEXT,
    revoked_at TIMESTAMP WITH TIME ZONE,
    
    FOREIGN KEY (course_id) REFERENCES courses(slug) ON DELETE CASCADE
);

-- Index for fast lookups by scholar address
CREATE INDEX IF NOT EXISTS idx_scholar_nfts_scholar_address 
    ON scholar_nfts (scholar_address);

-- Index for course lookups
CREATE INDEX IF NOT EXISTS idx_scholar_nfts_course_id 
    ON scholar_nfts (course_id);

-- Index for revocation status
CREATE INDEX IF NOT EXISTS idx_scholar_nfts_revoked 
    ON scholar_nfts (revoked);

COMMENT ON TABLE scholar_nfts IS 'Stores ScholarNFT credential metadata and ownership information';
COMMENT ON COLUMN scholar_nfts.token_id IS 'Unique token ID from the ScholarNFT contract';
COMMENT ON COLUMN scholar_nfts.scholar_address IS 'Stellar address of the scholar who owns this NFT';
COMMENT ON COLUMN scholar_nfts.course_id IS 'Course slug this credential is for';
COMMENT ON COLUMN scholar_nfts.metadata_uri IS 'IPFS URI containing the NFT metadata';
COMMENT ON COLUMN scholar_nfts.revoked IS 'Whether this credential has been revoked';