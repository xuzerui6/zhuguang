CREATE TABLE `auth_challenges` (
	`id` text PRIMARY KEY NOT NULL,
	`phone_hash` text NOT NULL,
	`code_hash` text NOT NULL,
	`ip_hash` text NOT NULL,
	`attempts` integer DEFAULT 0 NOT NULL,
	`expires_at` integer NOT NULL,
	`resend_after` integer NOT NULL,
	`locked_until` integer,
	`consumed_at` integer,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL
);
--> statement-breakpoint
CREATE INDEX `auth_challenges_phone_idx` ON `auth_challenges` (`phone_hash`,`created_at`);--> statement-breakpoint
CREATE INDEX `auth_challenges_ip_idx` ON `auth_challenges` (`ip_hash`,`created_at`);--> statement-breakpoint
CREATE TABLE `availability_slots` (
	`id` text PRIMARY KEY NOT NULL,
	`coach_id` integer NOT NULL,
	`venue_id` text NOT NULL,
	`starts_at` integer NOT NULL,
	`ends_at` integer NOT NULL,
	`status` text DEFAULT 'open' NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`coach_id`) REFERENCES `coaches`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`venue_id`) REFERENCES `venues`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "availability_slots_time_check" CHECK("availability_slots"."ends_at" > "availability_slots"."starts_at")
);
--> statement-breakpoint
CREATE UNIQUE INDEX `availability_slots_coach_time_unique` ON `availability_slots` (`coach_id`,`starts_at`,`ends_at`);--> statement-breakpoint
CREATE INDEX `availability_slots_query_idx` ON `availability_slots` (`coach_id`,`status`,`starts_at`);--> statement-breakpoint
CREATE TABLE `booking_events` (
	`id` text PRIMARY KEY NOT NULL,
	`booking_id` text NOT NULL,
	`actor_type` text NOT NULL,
	`actor_id` text,
	`from_status` text,
	`to_status` text NOT NULL,
	`detail_json` text DEFAULT '{}' NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`booking_id`) REFERENCES `booking_requests`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `booking_events_booking_idx` ON `booking_events` (`booking_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `booking_requests` (
	`id` text PRIMARY KEY NOT NULL,
	`idempotency_key` text NOT NULL,
	`user_id` text NOT NULL,
	`learner_profile_id` text NOT NULL,
	`coach_id` integer NOT NULL,
	`venue_id` text NOT NULL,
	`slot_id` text NOT NULL,
	`status` text DEFAULT 'pending_coach' NOT NULL,
	`fee_fen` integer NOT NULL,
	`payment_status` text DEFAULT 'offline_unpaid' NOT NULL,
	`note` text DEFAULT '' NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`completed_at` integer,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`learner_profile_id`) REFERENCES `learner_profiles`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`coach_id`) REFERENCES `coaches`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`venue_id`) REFERENCES `venues`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`slot_id`) REFERENCES `availability_slots`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `booking_requests_user_idempotency_unique` ON `booking_requests` (`user_id`,`idempotency_key`);--> statement-breakpoint
CREATE UNIQUE INDEX `booking_requests_active_slot_unique` ON `booking_requests` (`slot_id`) WHERE "booking_requests"."status" in ('pending_coach', 'confirmed', 'reschedule_requested');--> statement-breakpoint
CREATE INDEX `booking_requests_student_idx` ON `booking_requests` (`user_id`,`status`,`created_at`);--> statement-breakpoint
CREATE INDEX `booking_requests_coach_idx` ON `booking_requests` (`coach_id`,`status`,`created_at`);--> statement-breakpoint
CREATE TABLE `coach_credentials` (
	`id` text PRIMARY KEY NOT NULL,
	`coach_id` integer NOT NULL,
	`credential_type` text NOT NULL,
	`label` text NOT NULL,
	`issuer` text,
	`object_key` text NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`verified_at` integer,
	`reviewed_by` text,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`coach_id`) REFERENCES `coaches`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `coach_credentials_coach_idx` ON `coach_credentials` (`coach_id`,`status`);--> statement-breakpoint
CREATE TABLE `coaches` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_id` text,
	`siwc_email` text,
	`name` text NOT NULL,
	`sport` text NOT NULL,
	`city` text DEFAULT '北京' NOT NULL,
	`district` text NOT NULL,
	`level` text NOT NULL,
	`title` text NOT NULL,
	`bio` text NOT NULL,
	`price_fen` integer NOT NULL,
	`trial_price_fen` integer DEFAULT 9900 NOT NULL,
	`rating_basis_points` integer DEFAULT 0 NOT NULL,
	`lessons` integer DEFAULT 0 NOT NULL,
	`review_count` integer DEFAULT 0 NOT NULL,
	`experience_years` integer DEFAULT 0 NOT NULL,
	`response_minutes` integer DEFAULT 0 NOT NULL,
	`audience_json` text DEFAULT '[]' NOT NULL,
	`goals_json` text DEFAULT '[]' NOT NULL,
	`strengths_json` text DEFAULT '[]' NOT NULL,
	`availability_summary_json` text DEFAULT '[]' NOT NULL,
	`audit_status` text DEFAULT 'draft' NOT NULL,
	`avatar_object_key` text,
	`hero_object_key` text,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `coaches_siwc_email_unique` ON `coaches` (`siwc_email`);--> statement-breakpoint
CREATE INDEX `coaches_discovery_idx` ON `coaches` (`city`,`sport`,`audit_status`);--> statement-breakpoint
CREATE INDEX `coaches_district_idx` ON `coaches` (`city`,`district`);--> statement-breakpoint
CREATE TABLE `conversations` (
	`id` text PRIMARY KEY NOT NULL,
	`student_user_id` text NOT NULL,
	`coach_id` integer,
	`kind` text NOT NULL,
	`title` text NOT NULL,
	`last_message_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`student_user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`coach_id`) REFERENCES `coaches`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `conversations_student_coach_unique` ON `conversations` (`student_user_id`,`coach_id`);--> statement-breakpoint
CREATE INDEX `conversations_student_idx` ON `conversations` (`student_user_id`,`last_message_at`);--> statement-breakpoint
CREATE TABLE `favorites` (
	`user_id` text NOT NULL,
	`coach_id` integer NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	PRIMARY KEY(`user_id`, `coach_id`),
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`coach_id`) REFERENCES `coaches`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `learner_profiles` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`name` text NOT NULL,
	`relation` text NOT NULL,
	`gender` text DEFAULT 'unspecified' NOT NULL,
	`birth_year` integer,
	`sport` text NOT NULL,
	`level` text NOT NULL,
	`goal` text NOT NULL,
	`guardian_name` text,
	`guardian_phone_encrypted` text,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `learner_profiles_user_idx` ON `learner_profiles` (`user_id`);--> statement-breakpoint
CREATE TABLE `messages` (
	`id` text PRIMARY KEY NOT NULL,
	`conversation_id` text NOT NULL,
	`sender_type` text NOT NULL,
	`sender_id` text,
	`body` text NOT NULL,
	`read_at` integer,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`conversation_id`) REFERENCES `conversations`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `messages_conversation_idx` ON `messages` (`conversation_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `notifications` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`type` text NOT NULL,
	`title` text NOT NULL,
	`body` text NOT NULL,
	`entity_type` text,
	`entity_id` text,
	`read_at` integer,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `notifications_user_idx` ON `notifications` (`user_id`,`read_at`,`created_at`);--> statement-breakpoint
CREATE TABLE `sessions` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`device_id` text NOT NULL,
	`access_token_hash` text NOT NULL,
	`refresh_token_hash` text NOT NULL,
	`access_expires_at` integer NOT NULL,
	`refresh_expires_at` integer NOT NULL,
	`rotated_from_id` text,
	`last_seen_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`revoked_at` integer,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `sessions_access_token_hash_unique` ON `sessions` (`access_token_hash`);--> statement-breakpoint
CREATE UNIQUE INDEX `sessions_refresh_token_hash_unique` ON `sessions` (`refresh_token_hash`);--> statement-breakpoint
CREATE INDEX `sessions_user_device_idx` ON `sessions` (`user_id`,`device_id`,`revoked_at`);--> statement-breakpoint
CREATE TABLE `users` (
	`id` text PRIMARY KEY NOT NULL,
	`phone_hash` text NOT NULL,
	`phone_encrypted` text NOT NULL,
	`phone_last4` text NOT NULL,
	`role` text DEFAULT 'student' NOT NULL,
	`status` text DEFAULT 'active' NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`deleted_at` integer
);
--> statement-breakpoint
CREATE UNIQUE INDEX `users_phone_hash_unique` ON `users` (`phone_hash`);--> statement-breakpoint
CREATE INDEX `users_status_idx` ON `users` (`status`);--> statement-breakpoint
CREATE TABLE `venues` (
	`id` text PRIMARY KEY NOT NULL,
	`coach_id` integer NOT NULL,
	`name` text NOT NULL,
	`address` text NOT NULL,
	`city` text DEFAULT '北京' NOT NULL,
	`district` text NOT NULL,
	`active` integer DEFAULT true NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`coach_id`) REFERENCES `coaches`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `venues_coach_idx` ON `venues` (`coach_id`,`active`);