-- AlterTable
ALTER TABLE "trips" ADD COLUMN "last_lat" REAL;
ALTER TABLE "trips" ADD COLUMN "last_lng" REAL;
ALTER TABLE "trips" ADD COLUMN "last_ping_at" DATETIME;

