CREATE TABLE `payment_orders` (
  `id` text PRIMARY KEY NOT NULL,
  `booking_id` text NOT NULL REFERENCES `booking_requests`(`id`) ON DELETE RESTRICT,
  `user_id` text NOT NULL REFERENCES `users`(`id`) ON DELETE RESTRICT,
  `provider` text NOT NULL,
  `environment` text NOT NULL CHECK (`environment` IN ('test','production')),
  `idempotency_key` text NOT NULL,
  `amount_fen` integer NOT NULL CHECK (`amount_fen` > 0),
  `service_fee_fen` integer DEFAULT 0 NOT NULL CHECK (`service_fee_fen` >= 0),
  `currency` text DEFAULT 'CNY' NOT NULL CHECK (`currency` = 'CNY'),
  `status` text DEFAULT 'created' NOT NULL CHECK (`status` IN ('created','pending','paid','failed','closed','partially_refunded','refunded')),
  `provider_order_id` text,
  `paid_at` integer,
  `created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
  `updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
  UNIQUE (`user_id`,`idempotency_key`)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `payment_orders_active_booking_unique` ON `payment_orders` (`booking_id`) WHERE `status` IN ('created','pending','paid','partially_refunded');
--> statement-breakpoint
CREATE INDEX `payment_orders_status_idx` ON `payment_orders` (`status`,`created_at`);
--> statement-breakpoint
CREATE TABLE `payment_attempts` (
  `id` text PRIMARY KEY NOT NULL,
  `payment_order_id` text NOT NULL REFERENCES `payment_orders`(`id`) ON DELETE CASCADE,
  `provider_event_id` text,
  `action` text NOT NULL,
  `outcome` text NOT NULL,
  `detail_json` text DEFAULT '{}' NOT NULL,
  `created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `payment_attempts_provider_event_unique` ON `payment_attempts` (`provider_event_id`) WHERE `provider_event_id` IS NOT NULL;
--> statement-breakpoint
CREATE TABLE `refund_requests` (
  `id` text PRIMARY KEY NOT NULL,
  `payment_order_id` text NOT NULL REFERENCES `payment_orders`(`id`) ON DELETE RESTRICT,
  `requested_by_user_id` text NOT NULL REFERENCES `users`(`id`) ON DELETE RESTRICT,
  `amount_fen` integer NOT NULL CHECK (`amount_fen` > 0),
  `reason` text NOT NULL,
  `status` text DEFAULT 'pending_review' NOT NULL CHECK (`status` IN ('pending_review','approved','processing','succeeded','rejected','failed')),
  `reviewed_by` text,
  `review_note` text DEFAULT '' NOT NULL,
  `created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
  `updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL
);
--> statement-breakpoint
CREATE INDEX `refund_requests_status_idx` ON `refund_requests` (`status`,`created_at`);
--> statement-breakpoint
CREATE TABLE `refund_events` (
  `id` text PRIMARY KEY NOT NULL,
  `refund_request_id` text NOT NULL REFERENCES `refund_requests`(`id`) ON DELETE CASCADE,
  `from_status` text,
  `to_status` text NOT NULL,
  `actor` text NOT NULL,
  `detail_json` text DEFAULT '{}' NOT NULL,
  `created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL
);
--> statement-breakpoint
CREATE INDEX `refund_events_request_idx` ON `refund_events` (`refund_request_id`,`created_at`);
--> statement-breakpoint
CREATE TABLE `reconciliation_batches` (
  `id` text PRIMARY KEY NOT NULL,
  `provider` text NOT NULL,
  `environment` text NOT NULL CHECK (`environment` IN ('test','production')),
  `period_start` integer NOT NULL,
  `period_end` integer NOT NULL,
  `status` text DEFAULT 'pending' NOT NULL CHECK (`status` IN ('pending','matched','mismatch','closed')),
  `summary_json` text DEFAULT '{}' NOT NULL,
  `created_by` text NOT NULL,
  `created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `reconciliation_entries` (
  `id` text PRIMARY KEY NOT NULL,
  `batch_id` text NOT NULL REFERENCES `reconciliation_batches`(`id`) ON DELETE CASCADE,
  `payment_order_id` text REFERENCES `payment_orders`(`id`) ON DELETE SET NULL,
  `provider_order_id` text,
  `amount_fen` integer NOT NULL,
  `result` text NOT NULL CHECK (`result` IN ('matched','missing_local','missing_provider','amount_mismatch')),
  `created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL
);
--> statement-breakpoint
CREATE INDEX `reconciliation_entries_batch_idx` ON `reconciliation_entries` (`batch_id`,`result`);
