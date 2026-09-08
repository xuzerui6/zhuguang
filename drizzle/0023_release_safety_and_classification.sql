ALTER TABLE app_releases ADD COLUMN revision integer NOT NULL DEFAULT 0;
CREATE TRIGGER IF NOT EXISTS ops_audit_logs_no_update BEFORE UPDATE ON ops_audit_logs BEGIN SELECT RAISE(ABORT, 'audit logs are immutable'); END;
CREATE TRIGGER IF NOT EXISTS ops_audit_logs_no_delete BEFORE DELETE ON ops_audit_logs BEGIN SELECT RAISE(ABORT, 'audit logs are immutable'); END;
--> statement-breakpoint
CREATE TABLE release_upload_receipts (
  id text PRIMARY KEY NOT NULL,
  actor text NOT NULL,
  object_key text NOT NULL UNIQUE,
  sha256 text NOT NULL,
  size_bytes integer NOT NULL CHECK(size_bytes > 0 AND size_bytes <= 20971520),
  version_code integer NOT NULL,
  version_name text NOT NULL,
  created_at integer NOT NULL,
  expires_at integer NOT NULL,
  consumed_at integer
);
--> statement-breakpoint
CREATE TABLE release_operations (
  id text PRIMARY KEY NOT NULL,
  actor text NOT NULL,
  idempotency_key text NOT NULL,
  request_hash text NOT NULL,
  version_code integer NOT NULL,
  action text NOT NULL,
  reason text NOT NULL,
  result_json text NOT NULL,
  request_id text NOT NULL,
  created_at integer NOT NULL,
  UNIQUE(actor, idempotency_key)
);
CREATE UNIQUE INDEX release_notification_once ON release_operations(version_code) WHERE action = 'notify';
CREATE TRIGGER release_operations_no_update BEFORE UPDATE ON release_operations BEGIN SELECT RAISE(ABORT, 'release operations are immutable'); END;
CREATE TRIGGER release_operations_no_delete BEFORE DELETE ON release_operations BEGIN SELECT RAISE(ABORT, 'release operations are immutable'); END;
--> statement-breakpoint
ALTER TABLE product_events ADD COLUMN data_classification text NOT NULL DEFAULT 'unclassified' CHECK(data_classification IN ('production_eligible','qa','unclassified'));
CREATE INDEX product_event_classification_time ON product_events(data_classification,created_at);
--> statement-breakpoint
DROP VIEW public_eligible_coach_reviews;
CREATE TABLE entity_metric_classifications_v2 (
  entity_type text NOT NULL CHECK(entity_type IN ('user','booking','coach','review','support_ticket','service_lead','product_event')),
  entity_id text NOT NULL,
  classification text NOT NULL CHECK(classification IN ('unclassified','qa','production_eligible','excluded')),
  last_event_id text NOT NULL UNIQUE,
  updated_at integer NOT NULL,
  PRIMARY KEY(entity_type,entity_id)
);
INSERT INTO entity_metric_classifications_v2 SELECT * FROM entity_metric_classifications;
DROP TABLE entity_metric_classifications;
ALTER TABLE entity_metric_classifications_v2 RENAME TO entity_metric_classifications;
CREATE INDEX entity_metric_classification_lookup ON entity_metric_classifications(entity_type,classification,entity_id);
--> statement-breakpoint
CREATE TABLE metric_classification_events_v2 (
  id text PRIMARY KEY NOT NULL,
  entity_type text NOT NULL CHECK(entity_type IN ('user','booking','coach','review','support_ticket','service_lead','product_event')),
  entity_id text NOT NULL,
  classification text NOT NULL CHECK(classification IN ('unclassified','qa','production_eligible','excluded')),
  reason text NOT NULL, actor text NOT NULL, request_id text,
  created_at integer DEFAULT (unixepoch() * 1000) NOT NULL
);
INSERT INTO metric_classification_events_v2 SELECT * FROM metric_classification_events;
DROP TABLE metric_classification_events;
ALTER TABLE metric_classification_events_v2 RENAME TO metric_classification_events;
CREATE INDEX metric_classification_entity_idx ON metric_classification_events(entity_type,entity_id,created_at);
CREATE TRIGGER metric_classification_events_no_update BEFORE UPDATE ON metric_classification_events BEGIN SELECT RAISE(ABORT, 'classification events are immutable'); END;
CREATE TRIGGER metric_classification_events_no_delete BEFORE DELETE ON metric_classification_events BEGIN SELECT RAISE(ABORT, 'classification events are immutable'); END;
--> statement-breakpoint
CREATE VIEW public_eligible_coach_reviews AS
SELECT r.* FROM coach_reviews r
JOIN booking_requests b ON b.id=r.booking_id AND b.coach_id=r.coach_id AND b.user_id=r.user_id
JOIN users u ON u.id=r.user_id
JOIN coaches c ON c.id=r.coach_id
JOIN entity_metric_classifications rproof ON rproof.entity_type='review' AND rproof.entity_id=r.id AND rproof.classification='production_eligible'
JOIN entity_metric_classifications bproof ON bproof.entity_type='booking' AND bproof.entity_id=b.id AND bproof.classification='production_eligible'
JOIN entity_metric_classifications uproof ON uproof.entity_type='user' AND uproof.entity_id=u.id AND uproof.classification='production_eligible'
JOIN entity_metric_classifications cproof ON cproof.entity_type='coach' AND cproof.entity_id=CAST(c.id AS TEXT) AND cproof.classification='production_eligible'
WHERE r.status='approved' AND b.status='completed' AND u.status='active'
  AND c.profile_kind='real' AND c.audit_status='approved' AND c.listing_status='online' AND c.city='北京';
