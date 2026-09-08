CREATE TABLE booking_completion_responses (
  completion_request_id text PRIMARY KEY NOT NULL REFERENCES booking_completion_requests(id),
  operation_id text NOT NULL UNIQUE,
  user_id text NOT NULL REFERENCES users(id),
  idempotency_key text NOT NULL,
  request_hash text NOT NULL,
  decision text NOT NULL CHECK(decision IN ('accepted','disputed')),
  result_json text NOT NULL,
  request_id text,
  created_at integer NOT NULL,
  UNIQUE(user_id, idempotency_key)
);
--> statement-breakpoint
CREATE TRIGGER completion_responses_no_update BEFORE UPDATE ON booking_completion_responses BEGIN SELECT RAISE(ABORT, 'immutable_completion_response'); END;
--> statement-breakpoint
CREATE TRIGGER completion_responses_no_delete BEFORE DELETE ON booking_completion_responses BEGIN SELECT RAISE(ABORT, 'immutable_completion_response'); END;
