CREATE TABLE IF NOT EXISTS `public_download_events` (
	`id` text PRIMARY KEY NOT NULL,
	`version_code` integer NOT NULL,
	`ip_hash` text NOT NULL,
	`device_hash` text NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `public_download_events_ip_idx` ON `public_download_events` (`ip_hash`,`created_at`);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `public_download_events_device_idx` ON `public_download_events` (`device_hash`,`created_at`);
