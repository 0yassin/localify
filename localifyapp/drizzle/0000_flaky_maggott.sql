CREATE TABLE `playlists` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`url` text NOT NULL,
	`last_checked` text,
	`icon` text,
	`synced` integer DEFAULT true NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `playlists_id_unique` ON `playlists` (`id`);--> statement-breakpoint
CREATE UNIQUE INDEX `playlists_url_unique` ON `playlists` (`url`);--> statement-breakpoint
CREATE TABLE `tracks` (
	`id` text PRIMARY KEY NOT NULL,
	`playlist` text,
	`downloaded` integer DEFAULT false,
	`title` text NOT NULL,
	`artist` text,
	`filename` text,
	`image` text,
	`ytlink` text,
	FOREIGN KEY (`playlist`) REFERENCES `playlists`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `tracks_id_unique` ON `tracks` (`id`);--> statement-breakpoint
CREATE TABLE `user` (
	`id` integer PRIMARY KEY DEFAULT 1 NOT NULL,
	`theme` text DEFAULT 'light',
	`folder` text
);
