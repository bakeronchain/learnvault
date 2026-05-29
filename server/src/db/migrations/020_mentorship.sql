CREATE TABLE mentor_profiles (
  address       VARCHAR(56) PRIMARY KEY,
  skills        TEXT[]      NOT NULL DEFAULT '{}',
  availability  BOOLEAN     NOT NULL DEFAULT true,
  active        BOOLEAN     NOT NULL DEFAULT false,
  created_at    TIMESTAMP   NOT NULL DEFAULT NOW()
);

CREATE TABLE mentorship_requests (
  id              SERIAL      PRIMARY KEY,
  scholar_address VARCHAR(56) NOT NULL,
  skills_needed   TEXT[]      NOT NULL DEFAULT '{}',
  status          VARCHAR(20) NOT NULL DEFAULT 'pending',
  mentor_address  VARCHAR(56),
  created_at      TIMESTAMP   NOT NULL DEFAULT NOW()
);
