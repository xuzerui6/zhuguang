ALTER TABLE `coaches` ADD `honors_json` text DEFAULT '[]' NOT NULL;--> statement-breakpoint
ALTER TABLE `coaches` ADD `credentials_json` text DEFAULT '[]' NOT NULL;--> statement-breakpoint
ALTER TABLE `coaches` ADD `motto` text DEFAULT '' NOT NULL;
