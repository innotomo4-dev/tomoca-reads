CREATE TABLE `codes` (
	`id` text PRIMARY KEY NOT NULL,
	`branch` text NOT NULL,
	`expires` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `editions` (
	`id` text PRIMARY KEY NOT NULL,
	`data` text NOT NULL,
	`updated` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `registrations` (
	`phone` text PRIMARY KEY NOT NULL,
	`branch` text NOT NULL,
	`consent` integer NOT NULL,
	`created` integer NOT NULL,
	`notice` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `sessions` (
	`id` text PRIMARY KEY NOT NULL,
	`branch` text NOT NULL,
	`expires` integer NOT NULL,
	`created` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_sessions_branch_created` ON `sessions` (`branch`,`created`);