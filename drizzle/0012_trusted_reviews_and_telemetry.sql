ALTER TABLE coach_reviews ADD COLUMN tags_json text NOT NULL DEFAULT '[]';
ALTER TABLE coach_reviews ADD COLUMN helpful_count integer NOT NULL DEFAULT 0;
ALTER TABLE coach_reviews ADD COLUMN report_count integer NOT NULL DEFAULT 0;

CREATE TABLE coach_review_replies (
  id text PRIMARY KEY NOT NULL,
  review_id text NOT NULL UNIQUE REFERENCES coach_reviews(id) ON DELETE CASCADE,
  coach_id integer NOT NULL REFERENCES coaches(id) ON DELETE CASCADE,
  body text NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected','withdrawn')),
  reviewed_by text,
  review_note text NOT NULL DEFAULT '',
  reviewed_at integer,
  created_at integer NOT NULL DEFAULT (unixepoch() * 1000),
  updated_at integer NOT NULL DEFAULT (unixepoch() * 1000)
);
CREATE INDEX coach_review_replies_queue_idx ON coach_review_replies(status, created_at);

CREATE TABLE coach_review_reactions (
  review_id text NOT NULL REFERENCES coach_reviews(id) ON DELETE CASCADE,
  user_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  kind text NOT NULL CHECK (kind IN ('helpful','report')),
  reason text NOT NULL DEFAULT '',
  created_at integer NOT NULL DEFAULT (unixepoch() * 1000),
  PRIMARY KEY (review_id, user_id, kind)
);
CREATE INDEX coach_review_reactions_review_idx ON coach_review_reactions(review_id, kind, created_at);

CREATE TABLE product_events (
  id text PRIMARY KEY NOT NULL,
  session_id text NOT NULL,
  surface text NOT NULL,
  role text NOT NULL,
  flow text NOT NULL,
  step text NOT NULL,
  outcome text NOT NULL,
  error_code text,
  app_version text NOT NULL DEFAULT '',
  created_at integer NOT NULL DEFAULT (unixepoch() * 1000)
);
CREATE INDEX product_events_funnel_idx ON product_events(flow, step, outcome, created_at);
CREATE INDEX product_events_created_idx ON product_events(created_at);
