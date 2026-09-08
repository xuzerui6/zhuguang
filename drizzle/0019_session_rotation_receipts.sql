CREATE TABLE session_rotation_claims (
  parent_session_id text PRIMARY KEY NOT NULL REFERENCES sessions(id),
  operation_id text NOT NULL UNIQUE,
  child_session_id text NOT NULL,
  created_at integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE web_refresh_receipts (
  parent_session_id text PRIMARY KEY NOT NULL REFERENCES sessions(id),
  child_session_id text NOT NULL REFERENCES sessions(id),
  device_id text NOT NULL,
  request_hash text NOT NULL,
  result_encrypted text NOT NULL,
  expires_at integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX web_refresh_receipts_expiry_idx ON web_refresh_receipts(expires_at);
