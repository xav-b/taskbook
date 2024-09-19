CREATE TABLE `bullets` (
	`id` text PRIMARY KEY NOT NULL,
	`ctx_id` integer NOT NULL,
	`context` text,
	`bucket` text,
	`bullet_type` text NOT NULL,
	`is_task` integer NOT NULL,
	`is_starred` integer,
	`is_complete` integer DEFAULT false,
	`is_inprogress` integer DEFAULT false,
	`description` text NOT NULL,
	`comment` text,
	`link` text,
	`priority` integer DEFAULT 1 NOT NULL,
	`repeat` text,
	`boards` text,
	`tags` text,
	`started_at` integer,
	`duration` integer,
	`estimate` integer,
	`schedule` integer,
	`created_at` integer DEFAULT (cast(UNIXEPOCH() AS INT)) NOT NULL,
	`updated_at` integer DEFAULT (cast(UNIXEPOCH() AS INT)) NOT NULL
);
--> statement-breakpoint
CREATE INDEX `ctx_id_idx` ON `bullets` (`ctx_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `bucket_unique_constraint` ON `bullets` (`context`,`bucket`,`ctx_id`);