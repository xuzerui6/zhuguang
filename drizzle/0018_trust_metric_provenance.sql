ALTER TABLE `users` ADD `data_classification` text;
--> statement-breakpoint
ALTER TABLE `booking_requests` ADD `metric_eligible` integer;
--> statement-breakpoint
ALTER TABLE `coaches` ADD `public_verified_at` integer;
--> statement-breakpoint
CREATE TABLE `metric_classification_events` (
  `id` text PRIMARY KEY NOT NULL,
  `entity_type` text NOT NULL CHECK (`entity_type` IN ('user','booking','coach','review','support_ticket')),
  `entity_id` text NOT NULL,
  `classification` text NOT NULL CHECK (`classification` IN ('unclassified','qa','production_eligible','excluded')),
  `reason` text NOT NULL,
  `actor` text NOT NULL,
  `request_id` text,
  `created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL
);
--> statement-breakpoint
CREATE INDEX `metric_classification_entity_idx` ON `metric_classification_events` (`entity_type`,`entity_id`,`created_at`);
