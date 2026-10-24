-- AlterTable
ALTER TABLE "users" ADD COLUMN "department" TEXT;

-- CreateTable
CREATE TABLE "transport_requests" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "code" TEXT NOT NULL,
    "serviceType" TEXT NOT NULL DEFAULT 'STANDARD',
    "priority" TEXT NOT NULL DEFAULT 'SCHEDULED',
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "requester_id" TEXT,
    "requester_name" TEXT NOT NULL,
    "requester_phone" TEXT,
    "requester_dept" TEXT,
    "origin_id" TEXT NOT NULL,
    "destination_id" TEXT NOT NULL,
    "scheduled_at" DATETIME NOT NULL,
    "window_minutes" INTEGER NOT NULL DEFAULT 30,
    "estimated_minutes" INTEGER,
    "passenger_count" INTEGER,
    "reason" TEXT,
    "patient_name" TEXT,
    "patient_condition" TEXT,
    "requires_stretcher" BOOLEAN NOT NULL DEFAULT false,
    "requires_oxygen" BOOLEAN NOT NULL DEFAULT false,
    "clinical_notes" TEXT,
    "assigned_vehicle_id" TEXT,
    "assigned_driver_id" TEXT,
    "approved_by_id" TEXT,
    "approved_at" DATETIME,
    "rejection_reason" TEXT,
    "trip_id" TEXT,
    "dispatched_at" DATETIME,
    "completed_at" DATETIME,
    "sla_target_at" DATETIME,
    "sla_met_flag" BOOLEAN,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "transport_requests_requester_id_fkey" FOREIGN KEY ("requester_id") REFERENCES "users" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "transport_requests_origin_id_fkey" FOREIGN KEY ("origin_id") REFERENCES "locations" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "transport_requests_destination_id_fkey" FOREIGN KEY ("destination_id") REFERENCES "locations" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "transport_requests_assigned_vehicle_id_fkey" FOREIGN KEY ("assigned_vehicle_id") REFERENCES "vehicles" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "transport_requests_assigned_driver_id_fkey" FOREIGN KEY ("assigned_driver_id") REFERENCES "users" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "transport_requests_approved_by_id_fkey" FOREIGN KEY ("approved_by_id") REFERENCES "users" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "request_events" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "request_id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "user_id" TEXT,
    "comment" TEXT,
    "metadata" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "request_events_request_id_fkey" FOREIGN KEY ("request_id") REFERENCES "transport_requests" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "request_events_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "service_windows" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "service_type" TEXT NOT NULL,
    "branch_id" TEXT,
    "day_of_week" INTEGER NOT NULL,
    "start_time" TEXT NOT NULL,
    "end_time" TEXT NOT NULL,
    "slot_minutes" INTEGER NOT NULL DEFAULT 30,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "service_windows_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "schedule_blocks" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "resource_type" TEXT NOT NULL,
    "vehicle_id" TEXT,
    "driver_id" TEXT,
    "reason" TEXT NOT NULL,
    "start_at" DATETIME NOT NULL,
    "end_at" DATETIME NOT NULL,
    "note" TEXT,
    "created_by_id" TEXT NOT NULL,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "schedule_blocks_vehicle_id_fkey" FOREIGN KEY ("vehicle_id") REFERENCES "vehicles" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "schedule_blocks_driver_id_fkey" FOREIGN KEY ("driver_id") REFERENCES "users" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "external_providers" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "service_type" TEXT NOT NULL DEFAULT 'AMBULANCE',
    "phone" TEXT,
    "contact_name" TEXT,
    "coverage_note" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "external_referrals" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "request_id" TEXT,
    "service_type" TEXT NOT NULL,
    "provider_id" TEXT,
    "provider_name" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "patient_name" TEXT,
    "notes" TEXT,
    "status" TEXT NOT NULL DEFAULT 'REFERRED',
    "referred_by_id" TEXT NOT NULL,
    "referred_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "external_referrals_request_id_fkey" FOREIGN KEY ("request_id") REFERENCES "transport_requests" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "external_referrals_provider_id_fkey" FOREIGN KEY ("provider_id") REFERENCES "external_providers" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "transport_tasks" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "code" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'DELIVERY',
    "requester_id" TEXT,
    "requester_name" TEXT NOT NULL,
    "location_id" TEXT,
    "address_text" TEXT,
    "lat" REAL,
    "lng" REAL,
    "notes" TEXT,
    "priority" TEXT NOT NULL DEFAULT 'NORMAL',
    "window_start" DATETIME,
    "window_end" DATETIME,
    "service_time_min" INTEGER NOT NULL DEFAULT 5,
    "status" TEXT NOT NULL DEFAULT 'POOL',
    "route_id" TEXT,
    "trip_id" TEXT,
    "sort_order" INTEGER,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "transport_tasks_location_id_fkey" FOREIGN KEY ("location_id") REFERENCES "locations" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "transport_tasks_route_id_fkey" FOREIGN KEY ("route_id") REFERENCES "route_plans" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "transport_tasks_trip_id_fkey" FOREIGN KEY ("trip_id") REFERENCES "trips" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "route_plans" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "code" TEXT NOT NULL,
    "driver_id" TEXT,
    "vehicle_id" TEXT,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "planned_date" DATETIME NOT NULL,
    "total_distance_km" REAL,
    "total_duration_min" INTEGER,
    "optimized_order" TEXT,
    "optimizer_meta" TEXT,
    "trip_id" TEXT,
    "created_by_id" TEXT NOT NULL,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "route_plans_driver_id_fkey" FOREIGN KEY ("driver_id") REFERENCES "users" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "route_plans_vehicle_id_fkey" FOREIGN KEY ("vehicle_id") REFERENCES "vehicles" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "route_plans_trip_id_fkey" FOREIGN KEY ("trip_id") REFERENCES "trips" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_trips" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "driver_id" TEXT NOT NULL,
    "vehicle_id" TEXT NOT NULL,
    "origin_branch_id" TEXT NOT NULL,
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
    CONSTRAINT "trips_origin_branch_id_fkey" FOREIGN KEY ("origin_branch_id") REFERENCES "branches" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "trips_destination_id_fkey" FOREIGN KEY ("destination_id") REFERENCES "locations" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "trips_closure_branch_id_fkey" FOREIGN KEY ("closure_branch_id") REFERENCES "branches" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "trips_request_id_fkey" FOREIGN KEY ("request_id") REFERENCES "transport_requests" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_trips" ("closure_branch_id", "closure_type", "comment", "correction_flag", "created_at", "destination_id", "driver_id", "duration_minutes", "end_lat", "end_lng", "finished_at", "forced_close_flag", "id", "origin_branch_id", "start_lat", "start_lng", "started_at", "status", "telegram_delivery_status", "telegram_last_attempt_at", "telegram_last_result", "updated_at", "vehicle_id") SELECT "closure_branch_id", "closure_type", "comment", "correction_flag", "created_at", "destination_id", "driver_id", "duration_minutes", "end_lat", "end_lng", "finished_at", "forced_close_flag", "id", "origin_branch_id", "start_lat", "start_lng", "started_at", "status", "telegram_delivery_status", "telegram_last_attempt_at", "telegram_last_result", "updated_at", "vehicle_id" FROM "trips";
DROP TABLE "trips";
ALTER TABLE "new_trips" RENAME TO "trips";
CREATE UNIQUE INDEX "trips_request_id_key" ON "trips"("request_id");
CREATE TABLE "new_vehicles" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "plate" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "brand" TEXT NOT NULL,
    "year" INTEGER,
    "vehicle_type" TEXT,
    "service_class" TEXT NOT NULL DEFAULT 'ADMIN',
    "branch_id" TEXT,
    "fuel_type" TEXT,
    "color" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "current_trip_id" TEXT,
    "is_ambulance" BOOLEAN NOT NULL DEFAULT false,
    "has_stretcher" BOOLEAN NOT NULL DEFAULT false,
    "has_oxygen" BOOLEAN NOT NULL DEFAULT false,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "vehicles_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_vehicles" ("branch_id", "brand", "color", "created_at", "current_trip_id", "fuel_type", "id", "is_active", "model", "plate", "updated_at", "vehicle_type", "year") SELECT "branch_id", "brand", "color", "created_at", "current_trip_id", "fuel_type", "id", "is_active", "model", "plate", "updated_at", "vehicle_type", "year" FROM "vehicles";
DROP TABLE "vehicles";
ALTER TABLE "new_vehicles" RENAME TO "vehicles";
CREATE UNIQUE INDEX "vehicles_plate_key" ON "vehicles"("plate");
CREATE UNIQUE INDEX "vehicles_current_trip_id_key" ON "vehicles"("current_trip_id");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE UNIQUE INDEX "transport_requests_code_key" ON "transport_requests"("code");

-- CreateIndex
CREATE UNIQUE INDEX "transport_requests_trip_id_key" ON "transport_requests"("trip_id");

-- CreateIndex
CREATE UNIQUE INDEX "transport_tasks_code_key" ON "transport_tasks"("code");

-- CreateIndex
CREATE UNIQUE INDEX "route_plans_code_key" ON "route_plans"("code");

-- CreateIndex
CREATE UNIQUE INDEX "route_plans_trip_id_key" ON "route_plans"("trip_id");

