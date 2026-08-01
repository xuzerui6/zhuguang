CREATE TABLE `app_installations` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text,
	`platform` text DEFAULT 'android' NOT NULL,
	`app_version_code` integer NOT NULL,
	`app_version_name` text NOT NULL,
	`push_provider` text DEFAULT 'jpush' NOT NULL,
	`push_registration_id` text,
	`push_enabled` integer DEFAULT false NOT NULL,
	`status` text DEFAULT 'active' NOT NULL,
	`last_seen_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `app_installations_user_idx` ON `app_installations` (`user_id`,`status`);--> statement-breakpoint
CREATE INDEX `app_installations_push_idx` ON `app_installations` (`push_provider`,`push_registration_id`,`push_enabled`);--> statement-breakpoint
CREATE TABLE `app_releases` (
	`version_code` integer PRIMARY KEY NOT NULL,
	`version_name` text NOT NULL,
	`minimum_supported_version_code` integer NOT NULL,
	`forced` integer DEFAULT false NOT NULL,
	`rollout_percentage` integer DEFAULT 100 NOT NULL,
	`notes_json` text DEFAULT '[]' NOT NULL,
	`size_bytes` integer NOT NULL,
	`sha256` text NOT NULL,
	`certificate_sha256` text NOT NULL,
	`package_id` text DEFAULT 'com.zhuguang.coachos' NOT NULL,
	`object_key` text NOT NULL,
	`status` text DEFAULT 'draft' NOT NULL,
	`published_at` integer,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	CONSTRAINT "app_releases_rollout_check" CHECK("app_releases"."rollout_percentage" between 0 and 100)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `app_releases_version_name_unique` ON `app_releases` (`version_name`);--> statement-breakpoint
CREATE INDEX `app_releases_latest_idx` ON `app_releases` (`status`,`version_code`);--> statement-breakpoint
CREATE TABLE `app_update_events` (
	`id` text PRIMARY KEY NOT NULL,
	`installation_id` text NOT NULL,
	`user_id` text,
	`version_code` integer NOT NULL,
	`event_type` text NOT NULL,
	`detail_json` text DEFAULT '{}' NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`installation_id`) REFERENCES `app_installations`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `app_update_events_installation_idx` ON `app_update_events` (`installation_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `notification_preferences` (
	`user_id` text PRIMARY KEY NOT NULL,
	`booking_enabled` integer DEFAULT true NOT NULL,
	`message_enabled` integer DEFAULT true NOT NULL,
	`update_enabled` integer DEFAULT true NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `push_deliveries` (
	`id` text PRIMARY KEY NOT NULL,
	`notification_id` text NOT NULL,
	`installation_id` text NOT NULL,
	`provider` text DEFAULT 'jpush' NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`attempt_count` integer DEFAULT 0 NOT NULL,
	`provider_message_id` text,
	`last_error` text,
	`next_attempt_at` integer,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`notification_id`) REFERENCES `notifications`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`installation_id`) REFERENCES `app_installations`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `push_deliveries_notification_installation_unique` ON `push_deliveries` (`notification_id`,`installation_id`);--> statement-breakpoint
CREATE INDEX `push_deliveries_retry_idx` ON `push_deliveries` (`status`,`next_attempt_at`);--> statement-breakpoint
CREATE TABLE `user_roles` (
	`user_id` text NOT NULL,
	`role` text NOT NULL,
	`status` text DEFAULT 'active' NOT NULL,
	`granted_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	PRIMARY KEY(`user_id`, `role`),
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `user_roles_authorization_idx` ON `user_roles` (`user_id`,`status`,`role`);--> statement-breakpoint
ALTER TABLE `auth_challenges` ADD `device_hash` text DEFAULT '' NOT NULL;--> statement-breakpoint
CREATE INDEX `auth_challenges_device_idx` ON `auth_challenges` (`device_hash`,`created_at`);--> statement-breakpoint
ALTER TABLE `notifications` ADD `target_mode` text DEFAULT 'student' NOT NULL;--> statement-breakpoint
ALTER TABLE `notifications` ADD `deep_link` text;--> statement-breakpoint
CREATE UNIQUE INDEX `coaches_user_unique` ON `coaches` (`user_id`) WHERE "coaches"."user_id" is not null;
--> statement-breakpoint
INSERT OR IGNORE INTO `user_roles` (`user_id`, `role`, `status`, `granted_at`, `updated_at`)
SELECT `id`, 'student', 'active', (unixepoch() * 1000), (unixepoch() * 1000)
FROM `users` WHERE `status` = 'active' AND `deleted_at` IS NULL;
--> statement-breakpoint
INSERT OR IGNORE INTO `user_roles` (`user_id`, `role`, `status`, `granted_at`, `updated_at`)
SELECT `user_id`, 'coach', 'active', (unixepoch() * 1000), (unixepoch() * 1000)
FROM `coaches` WHERE `user_id` IS NOT NULL AND `audit_status` = 'approved';
