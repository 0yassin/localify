PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_playlists` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`url` text NOT NULL,
	`last_checked` text,
	`icon` text
);
--> statement-breakpoint
INSERT INTO `__new_playlists`("id", "name", "url", "last_checked", "icon") SELECT "id", "name", "url", "last_checked", "icon" FROM `playlists`;--> statement-breakpoint
DROP TABLE `playlists`;--> statement-breakpoint
ALTER TABLE `__new_playlists` RENAME TO `playlists`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE UNIQUE INDEX `playlists_id_unique` ON `playlists` (`id`);--> statement-breakpoint
CREATE UNIQUE INDEX `playlists_url_unique` ON `playlists` (`url`);--> statement-breakpoint
CREATE TABLE `__new_tracks` (
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
INSERT INTO `__new_tracks`("id", "playlist", "downloaded", "title", "artist", "filename", "image", "ytlink") SELECT "id", "playlist", "downloaded", "title", "artist", "filename", "image", "ytlink" FROM `tracks`;--> statement-breakpoint
DROP TABLE `tracks`;--> statement-breakpoint
ALTER TABLE `__new_tracks` RENAME TO `tracks`;--> statement-breakpoint
CREATE UNIQUE INDEX `tracks_id_unique` ON `tracks` (`id`);