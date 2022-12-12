-- CreateEnum
CREATE TYPE "PresetStatus" AS ENUM ('TRASHED', 'UPLOADING', 'UPLOADED', 'ABORTED', 'FAILED', 'TRASHED_PERMANENTLY', 'ACTIVE');

-- CreateEnum
CREATE TYPE "PresetAction" AS ENUM ('CREATED', 'UPDATED', 'DOWNLOADED', 'DELETED', 'RECOVERED');

-- CreateTable
CREATE TABLE "Preset" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "name" VARCHAR(150) NOT NULL,
    "size" BIGINT NOT NULL,
    "status" "PresetStatus" NOT NULL,
    "version" TEXT NOT NULL,
    "device_id" VARCHAR(100) NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "delete_at" TIMESTAMPTZ(3),

    CONSTRAINT "Preset_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PresetHistory" (
    "id" UUID NOT NULL,
    "preset_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "size" BIGINT NOT NULL,
    "version" TEXT NOT NULL,
    "device_id" VARCHAR(100) NOT NULL,
    "action" "PresetAction" NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PresetHistory_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Preset_delete_at_idx" ON "Preset"("delete_at");

-- AddForeignKey
ALTER TABLE "Preset" ADD CONSTRAINT "Preset_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PresetHistory" ADD CONSTRAINT "PresetHistory_preset_id_fkey" FOREIGN KEY ("preset_id") REFERENCES "Preset"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PresetHistory" ADD CONSTRAINT "PresetHistory_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddPresetHistoryTrigger
CREATE OR REPLACE FUNCTION add_preset_history() 
    RETURNS TRIGGER
AS $psql$
DECLARE
  action "UserAction";
BEGIN
    action := TG_ARGV[0];

    IF NEW.delete_at IS NOT NULL then
        action := 'DELETED';
    END IF;

    IF OLD.delete_at IS NOT NULL and NEW.delete_at IS NULL then
        action:= 'RECOVERED';
    END IF;

    INSERT INTO "PresetHistory"
        ("id", "preset_id", "user_id", "name", "size", "version", "device_id", "action") VALUES
        (uuid_generate_v4(), NEW.id, NEW.user_id, NEW.name, NEW.size, NEW.version, NEW.device_id, action);

    RETURN NEW;
END;
$psql$ LANGUAGE PLPGSQL;

-- Insert
DROP TRIGGER IF EXISTS preset_after_insert ON "Preset";
CREATE TRIGGER preset_after_insert AFTER INSERT ON "Preset" FOR EACH ROW EXECUTE FUNCTION add_preset_history('CREATED');

-- Update
DROP TRIGGER IF EXISTS preset_after_update ON "Preset";
CREATE TRIGGER preset_after_update AFTER UPDATE ON "Preset" FOR EACH ROW EXECUTE FUNCTION add_preset_history('UPDATED');
