CREATE TABLE user_profiles (
  user_id text PRIMARY KEY NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  nickname text NOT NULL DEFAULT '',
  avatar_object_key text,
  district text NOT NULL DEFAULT '',
  bio text NOT NULL DEFAULT '',
  completed_at integer,
  avatar_updated_at integer,
  created_at integer NOT NULL DEFAULT (unixepoch() * 1000),
  updated_at integer NOT NULL DEFAULT (unixepoch() * 1000)
);
CREATE INDEX user_profiles_updated_idx ON user_profiles(updated_at);

CREATE TABLE account_profile_events (
  id text PRIMARY KEY NOT NULL,
  user_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  event_type text NOT NULL,
  ip_hash text NOT NULL,
  device_hash text NOT NULL,
  detail_json text NOT NULL DEFAULT '{}',
  created_at integer NOT NULL DEFAULT (unixepoch() * 1000)
);
CREATE INDEX account_profile_events_user_idx ON account_profile_events(user_id, created_at);
CREATE INDEX account_profile_events_ip_idx ON account_profile_events(ip_hash, created_at);

CREATE TABLE account_contact_challenges (
  id text PRIMARY KEY NOT NULL,
  user_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  kind text NOT NULL CHECK (kind IN ('email','phone')),
  value_hash text NOT NULL,
  value_encrypted text NOT NULL,
  value_hint text NOT NULL,
  code_hash text NOT NULL,
  ip_hash text NOT NULL,
  device_hash text NOT NULL,
  attempts integer NOT NULL DEFAULT 0,
  expires_at integer NOT NULL,
  resend_after integer NOT NULL,
  locked_until integer,
  consumed_at integer,
  created_at integer NOT NULL DEFAULT (unixepoch() * 1000)
);
CREATE INDEX account_contact_challenges_user_idx ON account_contact_challenges(user_id, kind, created_at);
CREATE INDEX account_contact_challenges_value_idx ON account_contact_challenges(value_hash, created_at);

CREATE TABLE account_merge_requests (
  id text PRIMARY KEY NOT NULL,
  requested_by_user_id text NOT NULL REFERENCES users(id),
  conflicting_user_id text NOT NULL REFERENCES users(id),
  contact_kind text NOT NULL CHECK (contact_kind IN ('email','phone')),
  contact_hint text NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected','cancelled')),
  primary_user_id text REFERENCES users(id),
  reviewed_by text,
  review_note text NOT NULL DEFAULT '',
  reviewed_at integer,
  created_at integer NOT NULL DEFAULT (unixepoch() * 1000),
  updated_at integer NOT NULL DEFAULT (unixepoch() * 1000)
);
CREATE UNIQUE INDEX account_merge_requests_pending_unique
ON account_merge_requests(requested_by_user_id, conflicting_user_id, contact_kind)
WHERE status = 'pending';
CREATE INDEX account_merge_requests_queue_idx ON account_merge_requests(status, created_at);
