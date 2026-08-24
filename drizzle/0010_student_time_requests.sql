ALTER TABLE `availability_slots` ADD `source` text DEFAULT 'coach_open' NOT NULL;
--> statement-breakpoint
ALTER TABLE `availability_slots` ADD `owner_booking_id` text;
--> statement-breakpoint
DROP INDEX IF EXISTS `availability_slots_coach_time_unique`;
--> statement-breakpoint
CREATE INDEX `availability_slots_coach_time_idx` ON `availability_slots` (`coach_id`,`starts_at`,`ends_at`);
--> statement-breakpoint
CREATE TABLE `booking_request_details` (
  `booking_id` text PRIMARY KEY NOT NULL,
  `requested_starts_at` integer NOT NULL,
  `requested_ends_at` integer NOT NULL,
  `duration_minutes` integer NOT NULL,
  `location_type` text NOT NULL,
  `requested_venue_id` text,
  `custom_district` text,
  `custom_address` text,
  `custom_note` text,
  `expires_at` integer NOT NULL,
  `created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
  `updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
  FOREIGN KEY (`booking_id`) REFERENCES `booking_requests`(`id`) ON DELETE cascade,
  FOREIGN KEY (`requested_venue_id`) REFERENCES `venues`(`id`)
);
--> statement-breakpoint
CREATE INDEX `booking_request_details_expiry_idx` ON `booking_request_details` (`expires_at`);
--> statement-breakpoint
ALTER TABLE `booking_reschedule_proposals` ADD `location_type` text DEFAULT 'venue' NOT NULL;
--> statement-breakpoint
ALTER TABLE `booking_reschedule_proposals` ADD `custom_district` text;
--> statement-breakpoint
ALTER TABLE `booking_reschedule_proposals` ADD `custom_address` text;
--> statement-breakpoint
ALTER TABLE `booking_reschedule_proposals` ADD `custom_note` text;
