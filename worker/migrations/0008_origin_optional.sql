-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_trips" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "driver_id" TEXT NOT NULL,
    "vehicle_id" TEXT NOT NULL,
    "origin_branch_id" TEXT,
    "destination_id" TEXT NOT NULL,
    "closure_branch_id" TEXT,
    "status" TEXT NOT NULL DEFAULT 'IN_TRANSIT',
    "closure_type" TEXT,
    "started_at" DATETIME NOT NULL,
    "finished_at" DATETIME,
    "duration_minutes" INTEGER,
    "start_lat" REAL,
    "start_lng" REAL,
    "end_lat" REAL,
    "end_lng" REAL,
    "last_lat" REAL,
    "last_lng" REAL,
    "last_ping_at" DATETIME,
    "comment" TEXT,
    "correction_flag" BOOLEAN NOT NULL DEFAULT false,
    "forced_close_flag" BOOLEAN NOT NULL DEFAULT false,
    "telegram_delivery_status" TEXT NOT NULL DEFAULT 'PENDING',
    "telegram_last_attempt_at" DATETIME,
    "telegram_last_result" TEXT,
    "request_id" TEXT,
    "priority" TEXT NOT NULL DEFAULT 'NORMAL',
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "trips_driver_id_fkey" FOREIGN KEY ("driver_id") REFERENCES "users" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "trips_vehicle_id_fkey" FOREIGN KEY ("vehicle_id") REFERENCES "vehicles" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "trips_origin_branch_id_fkey" FOREIGN KEY ("origin_branch_id") REFERENCES "branches" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "trips_destination_id_fkey" FOREIGN KEY ("destination_id") REFERENCES "locations" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "trips_closure_branch_id_fkey" FOREIGN KEY ("closure_branch_id") REFERENCES "branches" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "trips_request_id_fkey" FOREIGN KEY ("request_id") REFERENCES "transport_requests" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_trips" ("closure_branch_id", "closure_type", "comment", "correction_flag", "created_at", "destination_id", "driver_id", "duration_minutes", "end_lat", "end_lng", "finished_at", "forced_close_flag", "id", "last_lat", "last_lng", "last_ping_at", "origin_branch_id", "priority", "request_id", "start_lat", "start_lng", "started_at", "status", "telegram_delivery_status", "telegram_last_attempt_at", "telegram_last_result", "updated_at", "vehicle_id") SELECT "closure_branch_id", "closure_type", "comment", "correction_flag", "created_at", "destination_id", "driver_id", "duration_minutes", "end_lat", "end_lng", "finished_at", "forced_close_flag", "id", "last_lat", "last_lng", "last_ping_at", "origin_branch_id", "priority", "request_id", "start_lat", "start_lng", "started_at", "status", "telegram_delivery_status", "telegram_last_attempt_at", "telegram_last_result", "updated_at", "vehicle_id" FROM "trips";
DROP TABLE "trips";
ALTER TABLE "new_trips" RENAME TO "trips";
CREATE UNIQUE INDEX "trips_request_id_key" ON "trips"("request_id");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

