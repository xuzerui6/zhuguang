CREATE TABLE `wechat_identities` (
	`id` text PRIMARY KEY NOT NULL,
	`app_id` text NOT NULL,
	`open_id_hash` text NOT NULL,
	`union_id_hash` text,
	`user_id` text NOT NULL,
	`status` text DEFAULT 'active' NOT NULL CHECK(`status` IN ('active', 'revoked')),
	`linked_at` integer NOT NULL,
	`last_login_at` integer NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `wechat_identities_app_open_unique` ON `wechat_identities` (`app_id`, `open_id_hash`);
CREATE UNIQUE INDEX `wechat_identities_app_union_unique` ON `wechat_identities` (`app_id`, `union_id_hash`) WHERE `union_id_hash` IS NOT NULL;
CREATE INDEX `wechat_identities_user_idx` ON `wechat_identities` (`user_id`, `status`);
--> statement-breakpoint
CREATE TABLE `wechat_link_challenges` (
	`id` text PRIMARY KEY NOT NULL,
	`app_id` text NOT NULL,
	`open_id_hash` text NOT NULL,
	`union_id_hash` text,
	`token_hash` text NOT NULL,
	`device_hash` text NOT NULL,
	`ip_hash` text NOT NULL,
	`attempts` integer DEFAULT 0 NOT NULL,
	`expires_at` integer NOT NULL,
	`consumed_at` integer,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `wechat_link_challenges_token_unique` ON `wechat_link_challenges` (`token_hash`);
CREATE INDEX `wechat_link_challenges_open_idx` ON `wechat_link_challenges` (`app_id`, `open_id_hash`, `created_at`);
CREATE INDEX `wechat_link_challenges_expiry_idx` ON `wechat_link_challenges` (`expires_at`, `consumed_at`);
--> statement-breakpoint
CREATE TABLE `wechat_auth_events` (
	`id` text PRIMARY KEY NOT NULL,
	`app_id` text NOT NULL,
	`code_hash` text NOT NULL,
	`open_id_hash` text,
	`ip_hash` text NOT NULL,
	`device_hash` text NOT NULL,
	`outcome` text NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `wechat_auth_events_code_unique` ON `wechat_auth_events` (`app_id`, `code_hash`);
CREATE INDEX `wechat_auth_events_ip_time_idx` ON `wechat_auth_events` (`ip_hash`, `created_at`);
CREATE INDEX `wechat_auth_events_device_time_idx` ON `wechat_auth_events` (`device_hash`, `created_at`);
