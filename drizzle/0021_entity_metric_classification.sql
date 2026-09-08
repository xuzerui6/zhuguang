CREATE TABLE entity_metric_classifications (
  entity_type text NOT NULL CHECK(entity_type IN ('user','booking','coach','review','support_ticket')),
  entity_id text NOT NULL,
  classification text NOT NULL CHECK(classification IN ('unclassified','qa','production_eligible','excluded')),
  last_event_id text NOT NULL UNIQUE,
  updated_at integer NOT NULL,
  PRIMARY KEY(entity_type,entity_id)
);
--> statement-breakpoint
CREATE INDEX entity_metric_classification_lookup ON entity_metric_classifications(entity_type,classification,entity_id);
