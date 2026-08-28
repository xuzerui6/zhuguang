ALTER TABLE coach_reviews ADD COLUMN resubmission_count integer NOT NULL DEFAULT 0;

CREATE TABLE coach_review_versions (
  id text PRIMARY KEY NOT NULL,
  review_id text NOT NULL REFERENCES coach_reviews(id) ON DELETE CASCADE,
  revision integer NOT NULL,
  rating integer NOT NULL,
  body text NOT NULL,
  tags_json text NOT NULL DEFAULT '[]',
  submission_type text NOT NULL,
  actor_user_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at integer NOT NULL DEFAULT (unixepoch() * 1000),
  CONSTRAINT coach_review_versions_revision_unique UNIQUE(review_id, revision),
  CONSTRAINT coach_review_versions_rating_check CHECK(rating BETWEEN 1 AND 5),
  CONSTRAINT coach_review_versions_type_check CHECK(submission_type IN ('initial', 'resubmission'))
);

CREATE INDEX coach_review_versions_review_idx ON coach_review_versions(review_id, revision);

INSERT INTO coach_review_versions (id, review_id, revision, rating, body, tags_json, submission_type, actor_user_id, created_at)
SELECT 'review_version_' || id, id, 1, rating, body, tags_json, 'initial', user_id, created_at
FROM coach_reviews;

UPDATE messages SET read_at = NULL WHERE sender_type = 'student';

CREATE INDEX messages_unread_idx ON messages(conversation_id, sender_type, read_at, created_at);
