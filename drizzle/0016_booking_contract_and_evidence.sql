CREATE TABLE `booking_contract_snapshots` (
  `id` text PRIMARY KEY NOT NULL,
  `booking_id` text NOT NULL UNIQUE REFERENCES `booking_requests`(`id`) ON DELETE CASCADE,
  `coach_id` integer NOT NULL REFERENCES `coaches`(`id`) ON DELETE RESTRICT,
  `learner_profile_id` text NOT NULL REFERENCES `learner_profiles`(`id`) ON DELETE RESTRICT,
  `city` text DEFAULT '北京' NOT NULL CHECK (`city` = '北京'),
  `sport` text NOT NULL,
  `duration_minutes` integer NOT NULL CHECK (`duration_minutes` IN (60,90,120)),
  `fee_fen` integer NOT NULL CHECK (`fee_fen` >= 0),
  `location_json` text NOT NULL,
  `pricing_json` text NOT NULL,
  `terms_version_id` text,
  `cancellation_policy_version_id` text,
  `created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL
);
--> statement-breakpoint
CREATE INDEX `booking_contract_snapshots_coach_idx` ON `booking_contract_snapshots` (`coach_id`,`created_at`);
--> statement-breakpoint
ALTER TABLE `booking_requests` ADD `contract_snapshot_id` text;
--> statement-breakpoint
CREATE TABLE `booking_completion_requests` (
  `id` text PRIMARY KEY NOT NULL,
  `booking_id` text NOT NULL UNIQUE REFERENCES `booking_requests`(`id`) ON DELETE CASCADE,
  `requested_by_user_id` text NOT NULL REFERENCES `users`(`id`) ON DELETE RESTRICT,
  `status` text DEFAULT 'pending_student' NOT NULL CHECK (`status` IN ('pending_student','accepted','disputed','withdrawn')),
  `coach_note` text DEFAULT '' NOT NULL,
  `student_note` text DEFAULT '' NOT NULL,
  `requested_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
  `responded_at` integer,
  `updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL
);
--> statement-breakpoint
CREATE INDEX `booking_completion_requests_status_idx` ON `booking_completion_requests` (`status`,`requested_at`);
--> statement-breakpoint
ALTER TABLE `support_tickets` ADD `ticket_kind` text;
--> statement-breakpoint
ALTER TABLE `support_tickets` ADD `completion_request_id` text;
--> statement-breakpoint
CREATE TABLE `support_ticket_attachments` (
  `id` text PRIMARY KEY NOT NULL,
  `ticket_id` text NOT NULL REFERENCES `support_tickets`(`id`) ON DELETE CASCADE,
  `uploaded_by_user_id` text NOT NULL REFERENCES `users`(`id`) ON DELETE RESTRICT,
  `object_key` text NOT NULL UNIQUE,
  `file_name` text NOT NULL,
  `content_type` text NOT NULL CHECK (`content_type` IN ('image/jpeg','image/png','image/webp','application/pdf')),
  `size_bytes` integer NOT NULL CHECK (`size_bytes` > 0 AND `size_bytes` <= 10485760),
  `sha256` text NOT NULL,
  `status` text DEFAULT 'available' NOT NULL CHECK (`status` IN ('pending','available','quarantined','deleted')),
  `created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL
);
--> statement-breakpoint
CREATE INDEX `support_ticket_attachments_ticket_idx` ON `support_ticket_attachments` (`ticket_id`,`created_at`);
