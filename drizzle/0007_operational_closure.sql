ALTER TABLE credential_change_requests ADD COLUMN current_value_json text NOT NULL DEFAULT 'null';

CREATE UNIQUE INDEX credential_change_requests_pending_field_unique
ON credential_change_requests(coach_id, field)
WHERE status = 'pending';

CREATE TABLE coach_profile_versions (
  id text PRIMARY KEY NOT NULL,
  coach_id integer NOT NULL REFERENCES coaches(id) ON DELETE CASCADE,
  request_id text REFERENCES credential_change_requests(id) ON DELETE SET NULL,
  field text NOT NULL,
  previous_value_json text NOT NULL,
  next_value_json text NOT NULL,
  approved_by text NOT NULL,
  created_at integer NOT NULL DEFAULT (unixepoch() * 1000)
);
CREATE INDEX coach_profile_versions_coach_idx ON coach_profile_versions(coach_id, created_at);

CREATE TABLE booking_reschedule_proposals (
  id text PRIMARY KEY NOT NULL,
  booking_id text NOT NULL REFERENCES booking_requests(id) ON DELETE CASCADE,
  proposed_slot_id text NOT NULL REFERENCES availability_slots(id),
  proposed_by text NOT NULL CHECK (proposed_by IN ('student','coach')),
  previous_booking_status text NOT NULL CHECK (previous_booking_status IN ('pending_coach','confirmed')),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','accepted','rejected','cancelled')),
  note text NOT NULL DEFAULT '',
  responded_at integer,
  created_at integer NOT NULL DEFAULT (unixepoch() * 1000),
  updated_at integer NOT NULL DEFAULT (unixepoch() * 1000)
);
CREATE INDEX booking_reschedule_queue_idx ON booking_reschedule_proposals(booking_id, status, created_at);

CREATE TABLE coach_reviews (
  id text PRIMARY KEY NOT NULL,
  booking_id text NOT NULL UNIQUE REFERENCES booking_requests(id) ON DELETE CASCADE,
  user_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  coach_id integer NOT NULL REFERENCES coaches(id) ON DELETE CASCADE,
  rating integer NOT NULL CHECK (rating BETWEEN 1 AND 5),
  body text NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected','withdrawn')),
  reviewed_by text,
  review_note text NOT NULL DEFAULT '',
  reviewed_at integer,
  created_at integer NOT NULL DEFAULT (unixepoch() * 1000),
  updated_at integer NOT NULL DEFAULT (unixepoch() * 1000)
);
CREATE INDEX coach_reviews_public_idx ON coach_reviews(coach_id, status, created_at);

CREATE TABLE support_tickets (
  id text PRIMARY KEY NOT NULL,
  booking_id text REFERENCES booking_requests(id) ON DELETE SET NULL,
  created_by_user_id text NOT NULL REFERENCES users(id),
  created_by_role text NOT NULL CHECK (created_by_role IN ('student','coach')),
  category text NOT NULL CHECK (category IN ('service','booking','payment','safety','privacy','other')),
  priority text NOT NULL DEFAULT 'normal' CHECK (priority IN ('normal','high','urgent')),
  subject text NOT NULL,
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open','in_progress','waiting_user','resolved','closed')),
  assigned_to text,
  created_at integer NOT NULL DEFAULT (unixepoch() * 1000),
  updated_at integer NOT NULL DEFAULT (unixepoch() * 1000),
  closed_at integer
);
CREATE INDEX support_tickets_queue_idx ON support_tickets(status, priority, updated_at);

CREATE TABLE support_ticket_messages (
  id text PRIMARY KEY NOT NULL,
  ticket_id text NOT NULL REFERENCES support_tickets(id) ON DELETE CASCADE,
  sender_type text NOT NULL CHECK (sender_type IN ('student','coach','operator','system')),
  sender_id text,
  body text NOT NULL,
  created_at integer NOT NULL DEFAULT (unixepoch() * 1000)
);
CREATE INDEX support_ticket_messages_ticket_idx ON support_ticket_messages(ticket_id, created_at);
