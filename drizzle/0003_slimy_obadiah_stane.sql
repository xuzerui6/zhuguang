CREATE TABLE `content_documents` (
	`id` text PRIMARY KEY NOT NULL,
	`slug` text NOT NULL,
	`title` text NOT NULL,
	`audience` text DEFAULT 'public' NOT NULL,
	`status` text DEFAULT 'draft' NOT NULL,
	`active_version_id` text,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `content_documents_slug_unique` ON `content_documents` (`slug`);--> statement-breakpoint
CREATE INDEX `content_documents_status_idx` ON `content_documents` (`status`,`updated_at`);--> statement-breakpoint
CREATE TABLE `content_versions` (
	`id` text PRIMARY KEY NOT NULL,
	`document_id` text NOT NULL,
	`version` integer NOT NULL,
	`body` text NOT NULL,
	`created_by` text,
	`published_at` integer,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`document_id`) REFERENCES `content_documents`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `content_versions_document_version_unique` ON `content_versions` (`document_id`,`version`);--> statement-breakpoint
CREATE INDEX `content_versions_document_idx` ON `content_versions` (`document_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `credential_change_requests` (
	`id` text PRIMARY KEY NOT NULL,
	`coach_id` integer NOT NULL,
	`field` text NOT NULL,
	`proposed_value_json` text NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`reviewed_by` text,
	`review_note` text DEFAULT '' NOT NULL,
	`reviewed_at` integer,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`coach_id`) REFERENCES `coaches`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `credential_change_requests_queue_idx` ON `credential_change_requests` (`status`,`created_at`);--> statement-breakpoint
CREATE TABLE `email_auth_challenges` (
	`id` text PRIMARY KEY NOT NULL,
	`email_hash` text NOT NULL,
	`email_encrypted` text NOT NULL,
	`email_domain` text NOT NULL,
	`code_hash` text NOT NULL,
	`ip_hash` text NOT NULL,
	`device_hash` text DEFAULT '' NOT NULL,
	`attempts` integer DEFAULT 0 NOT NULL,
	`expires_at` integer NOT NULL,
	`resend_after` integer NOT NULL,
	`locked_until` integer,
	`consumed_at` integer,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL
);
--> statement-breakpoint
CREATE INDEX `email_auth_challenges_email_idx` ON `email_auth_challenges` (`email_hash`,`created_at`);--> statement-breakpoint
CREATE INDEX `email_auth_challenges_ip_idx` ON `email_auth_challenges` (`ip_hash`,`created_at`);--> statement-breakpoint
CREATE INDEX `email_auth_challenges_device_idx` ON `email_auth_challenges` (`device_hash`,`created_at`);--> statement-breakpoint
CREATE TABLE `email_deliveries` (
	`id` text PRIMARY KEY NOT NULL,
	`challenge_id` text,
	`user_id` text,
	`recipient_hash` text NOT NULL,
	`template` text NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`attempt_count` integer DEFAULT 0 NOT NULL,
	`provider_message_id` text,
	`last_error` text,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`challenge_id`) REFERENCES `email_auth_challenges`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `email_deliveries_status_idx` ON `email_deliveries` (`status`,`created_at`);--> statement-breakpoint
CREATE INDEX `email_deliveries_recipient_idx` ON `email_deliveries` (`recipient_hash`,`created_at`);--> statement-breakpoint
CREATE TABLE `ops_audit_logs` (
	`id` text PRIMARY KEY NOT NULL,
	`actor` text NOT NULL,
	`action` text NOT NULL,
	`entity_type` text NOT NULL,
	`entity_id` text,
	`detail_json` text DEFAULT '{}' NOT NULL,
	`request_id` text,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL
);
--> statement-breakpoint
CREATE INDEX `ops_audit_logs_entity_idx` ON `ops_audit_logs` (`entity_type`,`entity_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `service_leads` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text,
	`coach_id` integer,
	`contact_name` text NOT NULL,
	`contact_email_encrypted` text,
	`sport` text NOT NULL,
	`district` text NOT NULL,
	`goal` text NOT NULL,
	`source` text DEFAULT 'web' NOT NULL,
	`status` text DEFAULT 'new' NOT NULL,
	`assigned_to` text,
	`note` text DEFAULT '' NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`coach_id`) REFERENCES `coaches`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `service_leads_queue_idx` ON `service_leads` (`status`,`created_at`);--> statement-breakpoint
CREATE INDEX `service_leads_coach_idx` ON `service_leads` (`coach_id`,`status`);--> statement-breakpoint
CREATE TABLE `training_records` (
	`id` text PRIMARY KEY NOT NULL,
	`booking_id` text NOT NULL,
	`user_id` text NOT NULL,
	`coach_id` integer NOT NULL,
	`summary` text NOT NULL,
	`metrics_json` text DEFAULT '{}' NOT NULL,
	`coach_notes` text DEFAULT '' NOT NULL,
	`published_at` integer,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`booking_id`) REFERENCES `booking_requests`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`coach_id`) REFERENCES `coaches`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `training_records_booking_id_unique` ON `training_records` (`booking_id`);--> statement-breakpoint
CREATE INDEX `training_records_student_idx` ON `training_records` (`user_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `training_records_coach_idx` ON `training_records` (`coach_id`,`created_at`);--> statement-breakpoint
PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_users` (
	`id` text PRIMARY KEY NOT NULL,
	`phone_hash` text,
	`phone_encrypted` text,
	`phone_last4` text,
	`email_hash` text,
	`email_encrypted` text,
	`email_domain` text,
	`role` text DEFAULT 'student' NOT NULL,
	`status` text DEFAULT 'active' NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`deleted_at` integer
);
--> statement-breakpoint
INSERT INTO `__new_users`("id", "phone_hash", "phone_encrypted", "phone_last4", "role", "status", "created_at", "updated_at", "deleted_at") SELECT "id", "phone_hash", "phone_encrypted", "phone_last4", "role", "status", "created_at", "updated_at", "deleted_at" FROM `users`;--> statement-breakpoint
DROP TABLE `users`;--> statement-breakpoint
ALTER TABLE `__new_users` RENAME TO `users`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE UNIQUE INDEX `users_phone_hash_unique` ON `users` (`phone_hash`);--> statement-breakpoint
CREATE UNIQUE INDEX `users_email_hash_unique` ON `users` (`email_hash`);--> statement-breakpoint
CREATE INDEX `users_status_idx` ON `users` (`status`);--> statement-breakpoint
ALTER TABLE `sessions` ADD `auth_method` text DEFAULT 'phone_otp' NOT NULL;
