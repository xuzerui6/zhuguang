CREATE TABLE `service_cities` (
  `id` text PRIMARY KEY NOT NULL,
  `name` text NOT NULL UNIQUE,
  `province` text NOT NULL,
  `status` text DEFAULT 'published' NOT NULL CHECK (`status` IN ('configured','published','disabled')),
  `sort_order` integer DEFAULT 0 NOT NULL,
  `created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
  `updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `service_areas` (
  `id` text PRIMARY KEY NOT NULL,
  `city_id` text NOT NULL REFERENCES `service_cities`(`id`) ON DELETE RESTRICT,
  `name` text NOT NULL,
  `status` text DEFAULT 'published' NOT NULL CHECK (`status` IN ('configured','published','disabled')),
  `sort_order` integer DEFAULT 0 NOT NULL,
  `created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
  `updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
  UNIQUE (`city_id`,`name`)
);
--> statement-breakpoint
CREATE INDEX `service_areas_city_status_idx` ON `service_areas` (`city_id`,`status`,`sort_order`);
--> statement-breakpoint
CREATE TABLE `coach_service_areas` (
  `coach_id` integer NOT NULL REFERENCES `coaches`(`id`) ON DELETE CASCADE,
  `area_id` text NOT NULL REFERENCES `service_areas`(`id`) ON DELETE RESTRICT,
  `is_primary` integer DEFAULT 0 NOT NULL CHECK (`is_primary` IN (0,1)),
  `created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
  PRIMARY KEY (`coach_id`,`area_id`)
);
--> statement-breakpoint
CREATE INDEX `coach_service_areas_public_idx` ON `coach_service_areas` (`area_id`,`coach_id`);
--> statement-breakpoint
CREATE TABLE `user_service_preferences` (
  `user_id` text PRIMARY KEY NOT NULL REFERENCES `users`(`id`) ON DELETE CASCADE,
  `city_id` text NOT NULL REFERENCES `service_cities`(`id`) ON DELETE RESTRICT,
  `source` text DEFAULT 'manual' NOT NULL CHECK (`source` IN ('manual','location')),
  `updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `coach_applications` (
  `id` text PRIMARY KEY NOT NULL,
  `user_id` text NOT NULL REFERENCES `users`(`id`) ON DELETE CASCADE,
  `status` text DEFAULT 'draft' NOT NULL CHECK (`status` IN ('draft','pending','approved','rejected','withdrawn')),
  `real_name` text NOT NULL,
  `title` text NOT NULL,
  `bio` text NOT NULL,
  `experience_years` integer NOT NULL CHECK (`experience_years` >= 0 AND `experience_years` <= 80),
  `audience_json` text DEFAULT '[]' NOT NULL,
  `goals_json` text DEFAULT '[]' NOT NULL,
  `strengths_json` text DEFAULT '[]' NOT NULL,
  `honors_json` text DEFAULT '[]' NOT NULL,
  `credentials_json` text DEFAULT '[]' NOT NULL,
  `price_fen` integer CHECK (`price_fen` > 0),
  `trial_price_fen` integer CHECK (`trial_price_fen` > 0),
  `avatar_temp_key` text DEFAULT '' NOT NULL,
  `hero_temp_key` text DEFAULT '' NOT NULL,
  `credential_temp_keys_json` text DEFAULT '[]' NOT NULL,
  `review_note` text,
  `reviewed_by` text,
  `reviewed_at` integer,
  `review_token` text,
  `created_coach_id` integer REFERENCES `coaches`(`id`) ON DELETE SET NULL,
  `submitted_at` integer,
  `created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
  `updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `coach_applications_active_user_unique` ON `coach_applications` (`user_id`) WHERE `status` IN ('draft','pending');
CREATE INDEX `coach_applications_review_idx` ON `coach_applications` (`status`,`submitted_at`,`created_at`);
--> statement-breakpoint
CREATE TABLE `coach_application_sports` (
  `application_id` text NOT NULL REFERENCES `coach_applications`(`id`) ON DELETE CASCADE,
  `sport_id` text NOT NULL REFERENCES `service_sports`(`id`) ON DELETE RESTRICT,
  `is_primary` integer DEFAULT 0 NOT NULL CHECK (`is_primary` IN (0,1)),
  PRIMARY KEY (`application_id`,`sport_id`)
);
--> statement-breakpoint
CREATE TABLE `coach_application_areas` (
  `application_id` text NOT NULL REFERENCES `coach_applications`(`id`) ON DELETE CASCADE,
  `area_id` text NOT NULL REFERENCES `service_areas`(`id`) ON DELETE RESTRICT,
  `is_primary` integer DEFAULT 0 NOT NULL CHECK (`is_primary` IN (0,1)),
  PRIMARY KEY (`application_id`,`area_id`)
);
--> statement-breakpoint
CREATE TABLE `coach_application_venues` (
  `id` text PRIMARY KEY NOT NULL,
  `application_id` text NOT NULL REFERENCES `coach_applications`(`id`) ON DELETE CASCADE,
  `area_id` text NOT NULL REFERENCES `service_areas`(`id`) ON DELETE RESTRICT,
  `name` text NOT NULL,
  `address` text NOT NULL,
  `created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `coach_application_events` (
  `id` text PRIMARY KEY NOT NULL,
  `application_id` text NOT NULL REFERENCES `coach_applications`(`id`) ON DELETE CASCADE,
  `actor` text NOT NULL,
  `event_type` text NOT NULL,
  `detail_json` text DEFAULT '{}' NOT NULL,
  `created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL
);
--> statement-breakpoint
CREATE INDEX `coach_application_events_idx` ON `coach_application_events` (`application_id`,`created_at`);
--> statement-breakpoint
CREATE TRIGGER `coach_application_events_no_update` BEFORE UPDATE ON `coach_application_events` BEGIN SELECT RAISE(ABORT, 'application events are immutable'); END;
CREATE TRIGGER `coach_application_events_no_delete` BEFORE DELETE ON `coach_application_events` BEGIN SELECT RAISE(ABORT, 'application events are immutable'); END;
--> statement-breakpoint
ALTER TABLE `booking_request_details` ADD `custom_city` text;
--> statement-breakpoint
ALTER TABLE `service_leads` ADD `service_city_id` text REFERENCES `service_cities`(`id`) ON DELETE RESTRICT;
--> statement-breakpoint
INSERT INTO `service_cities` (`id`,`name`,`province`,`sort_order`) VALUES
  ('beijing','北京','北京市',10),('changchun','长春','吉林省',20);
--> statement-breakpoint
INSERT INTO `service_areas` (`id`,`city_id`,`name`,`sort_order`)
SELECT 'beijing-' || substr(id, 9), 'beijing', district, sort_order FROM `service_regions`;
--> statement-breakpoint
INSERT INTO `service_areas` (`id`,`city_id`,`name`,`sort_order`) VALUES
  ('changchun-chaoyang','changchun','朝阳区',10),('changchun-nanguan','changchun','南关区',20),
  ('changchun-kuancheng','changchun','宽城区',30),('changchun-erdao','changchun','二道区',40),
  ('changchun-lvyuan','changchun','绿园区',50),('changchun-shuangyang','changchun','双阳区',60),
  ('changchun-jiutai','changchun','九台区',70);
--> statement-breakpoint
INSERT OR IGNORE INTO `coach_service_areas` (`coach_id`,`area_id`,`is_primary`)
SELECT cr.coach_id, 'beijing-' || substr(cr.region_id, 9), cr.is_primary FROM `coach_service_regions` cr;
--> statement-breakpoint
INSERT OR IGNORE INTO `coach_service_areas` (`coach_id`,`area_id`,`is_primary`)
SELECT c.id, a.id, 0 FROM `coaches` c CROSS JOIN `service_areas` a
WHERE c.id = 5 AND c.profile_kind = 'real' AND a.city_id = 'changchun';
