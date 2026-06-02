CREATE TABLE course_reviews (
    id               SERIAL PRIMARY KEY,
    course_id        INTEGER NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
    learner_address  TEXT NOT NULL,
    rating           INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 5),
    review_text      TEXT,
    created_at       TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (course_id, learner_address)
);

CREATE INDEX idx_course_reviews_course_id ON course_reviews (course_id);
CREATE INDEX idx_course_reviews_learner   ON course_reviews (learner_address);
