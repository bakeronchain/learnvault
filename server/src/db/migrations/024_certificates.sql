-- ============================================================
-- Migration 024: Certificate metadata storage
-- ============================================================

CREATE TABLE IF NOT EXISTS certificates (
    id            SERIAL PRIMARY KEY,
    user_id       TEXT NOT NULL,
    course_id     TEXT NOT NULL REFERENCES courses(slug) ON DELETE RESTRICT,
    issued_at     TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    pdf_hash      TEXT NOT NULL,
    pdf_url       TEXT,
    UNIQUE (user_id, course_id)
);

CREATE INDEX IF NOT EXISTS idx_certificates_user_id    ON certificates (user_id);
CREATE INDEX IF NOT EXISTS idx_certificates_course_id  ON certificates (course_id);

COMMENT ON TABLE  certificates             IS 'Issued PDF course-completion certificates with tamper-evident hashes';
COMMENT ON COLUMN certificates.user_id    IS 'Stellar wallet address of the learner';
COMMENT ON COLUMN certificates.course_id  IS 'Course slug the certificate was issued for';
COMMENT ON COLUMN certificates.pdf_hash   IS 'SHA-256 hex digest of the generated PDF bytes';
COMMENT ON COLUMN certificates.pdf_url    IS 'Optional storage URL (e.g. IPFS or CDN) for the PDF';
