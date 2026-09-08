CREATE TABLE `service_regions` (
  `id` text PRIMARY KEY NOT NULL,
  `city` text DEFAULT '北京' NOT NULL CHECK (`city` = '北京'),
  `district` text NOT NULL UNIQUE CHECK (`district` IN ('东城区','西城区','朝阳区','丰台区','石景山区','海淀区','门头沟区','房山区','通州区','顺义区','昌平区','大兴区','怀柔区','平谷区','密云区','延庆区')),
  `status` text DEFAULT 'configured' NOT NULL CHECK (`status` IN ('configured','published','disabled')),
  `sort_order` integer DEFAULT 0 NOT NULL,
  `created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
  `updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL
);
--> statement-breakpoint
CREATE INDEX `service_regions_status_idx` ON `service_regions` (`status`,`sort_order`);
--> statement-breakpoint
CREATE TABLE `service_sports` (
  `id` text PRIMARY KEY NOT NULL,
  `name` text NOT NULL UNIQUE,
  `status` text DEFAULT 'configured' NOT NULL CHECK (`status` IN ('configured','published','disabled')),
  `sort_order` integer DEFAULT 0 NOT NULL,
  `created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
  `updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL
);
--> statement-breakpoint
CREATE INDEX `service_sports_status_idx` ON `service_sports` (`status`,`sort_order`);
--> statement-breakpoint
CREATE TABLE `coach_service_regions` (
  `coach_id` integer NOT NULL REFERENCES `coaches`(`id`) ON DELETE CASCADE,
  `region_id` text NOT NULL REFERENCES `service_regions`(`id`) ON DELETE RESTRICT,
  `is_primary` integer DEFAULT 0 NOT NULL CHECK (`is_primary` IN (0,1)),
  `created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
  PRIMARY KEY (`coach_id`,`region_id`)
);
--> statement-breakpoint
CREATE INDEX `coach_service_regions_public_idx` ON `coach_service_regions` (`region_id`,`coach_id`);
--> statement-breakpoint
CREATE TABLE `coach_sports` (
  `coach_id` integer NOT NULL REFERENCES `coaches`(`id`) ON DELETE CASCADE,
  `sport_id` text NOT NULL REFERENCES `service_sports`(`id`) ON DELETE RESTRICT,
  `is_primary` integer DEFAULT 0 NOT NULL CHECK (`is_primary` IN (0,1)),
  `created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
  PRIMARY KEY (`coach_id`,`sport_id`)
);
--> statement-breakpoint
CREATE INDEX `coach_sports_public_idx` ON `coach_sports` (`sport_id`,`coach_id`);
--> statement-breakpoint
ALTER TABLE `service_leads` ADD `follow_up_due_at` integer;
--> statement-breakpoint
INSERT INTO `service_regions` (`id`,`district`,`sort_order`) VALUES
('beijing-dongcheng','东城区',10),('beijing-xicheng','西城区',20),('beijing-chaoyang','朝阳区',30),
('beijing-fengtai','丰台区',40),('beijing-shijingshan','石景山区',50),('beijing-haidian','海淀区',60),
('beijing-mentougou','门头沟区',70),('beijing-fangshan','房山区',80),('beijing-tongzhou','通州区',90),
('beijing-shunyi','顺义区',100),('beijing-changping','昌平区',110),('beijing-daxing','大兴区',120),
('beijing-huairou','怀柔区',130),('beijing-pinggu','平谷区',140),('beijing-miyun','密云区',150),
('beijing-yanqing','延庆区',160);
--> statement-breakpoint
INSERT INTO `service_sports` (`id`,`name`,`sort_order`) VALUES
('sport-athletics','田径',10),('sport-badminton','羽毛球',20),('sport-swimming','游泳',30),
('sport-tennis','网球',40),('sport-basketball','篮球',50),('sport-fitness','体能',60);
--> statement-breakpoint
INSERT OR IGNORE INTO `coach_service_regions` (`coach_id`,`region_id`,`is_primary`)
SELECT c.id, r.id, 1 FROM coaches c JOIN service_regions r ON r.district = c.district WHERE c.city = '北京';
--> statement-breakpoint
INSERT OR IGNORE INTO `coach_sports` (`coach_id`,`sport_id`,`is_primary`)
SELECT c.id, s.id, 1 FROM coaches c JOIN service_sports s ON s.name = c.sport;
