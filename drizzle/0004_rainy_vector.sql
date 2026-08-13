CREATE TABLE `coach_status_events` (
	`id` text PRIMARY KEY NOT NULL,
	`coach_id` integer NOT NULL,
	`event_type` text NOT NULL,
	`from_status` text NOT NULL,
	`to_status` text NOT NULL,
	`reason` text DEFAULT '' NOT NULL,
	`actor` text NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`coach_id`) REFERENCES `coaches`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `coach_status_events_coach_idx` ON `coach_status_events` (`coach_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `coach_status_events_type_idx` ON `coach_status_events` (`event_type`,`created_at`);--> statement-breakpoint
DROP INDEX `coaches_discovery_idx`;--> statement-breakpoint
ALTER TABLE `coaches` ADD `profile_kind` text DEFAULT 'real' NOT NULL;--> statement-breakpoint
ALTER TABLE `coaches` ADD `listing_status` text DEFAULT 'online' NOT NULL;--> statement-breakpoint
ALTER TABLE `coaches` ADD `listing_reason` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `coaches` ADD `listing_changed_by` text;--> statement-breakpoint
ALTER TABLE `coaches` ADD `listing_changed_at` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
UPDATE `coaches` SET `listing_changed_at` = `updated_at` WHERE `listing_changed_at` = 0;--> statement-breakpoint
ALTER TABLE `coaches` ADD `pricing_status` text DEFAULT 'published' NOT NULL;--> statement-breakpoint
ALTER TABLE `coaches` ADD `card_object_key` text;--> statement-breakpoint
CREATE INDEX `coaches_listing_idx` ON `coaches` (`listing_status`,`profile_kind`,`updated_at`);--> statement-breakpoint
CREATE INDEX `coaches_discovery_idx` ON `coaches` (`city`,`sport`,`audit_status`,`listing_status`);
