-- CreateEnum
CREATE TYPE "FileType" AS ENUM ('VECTORNATOR', 'SILVER', 'PRESET');

-- AlterTable
ALTER TABLE "File" ADD COLUMN     "type" "FileType";

-- AlterTable
ALTER TABLE "Hierarchy" ADD COLUMN     "type" "FileType";

-- AlterTable
ALTER TABLE "FileHistory" ADD COLUMN     "type" "FileType";

-- AlterTable
ALTER TABLE "HierarchyHistory" ADD COLUMN     "type" "FileType";

-- DropForeignKey
ALTER TABLE "Preset" DROP CONSTRAINT "Preset_user_id_fkey";

-- DropForeignKey
ALTER TABLE "PresetHistory" DROP CONSTRAINT "PresetHistory_preset_id_fkey";

-- DropForeignKey
ALTER TABLE "PresetHistory" DROP CONSTRAINT "PresetHistory_user_id_fkey";

-- DropTable
DROP TABLE "Preset";

-- DropTable
DROP TABLE "PresetHistory";

-- DropEnum
DROP TYPE "PresetAction";

-- DropEnum
DROP TYPE "PresetStatus";

-- DropFunction
DROP FUNCTION IF EXISTS add_preset_history();

-- Modify add_file_history function
CREATE OR REPLACE FUNCTION add_file_history() RETURNS trigger
AS $psql$
DECLARE
  action "FileAction";
BEGIN
    action := TG_ARGV[0];
    IF NEW.delete_at IS NOT NULL then
        action:= 'DELETED';
    END IF;

    IF OLD.delete_at IS NOT NULL and NEW.delete_at IS NULL then
        action:= 'RECOVERED';
    END IF;

    INSERT INTO "FileHistory"
        (id, "file_id", "user_id", "device_id", "name", "size", "action", "has_conflict", "type") VALUES
        (uuid_generate_v4(), NEW.id, NEW.user_id, NEW.device_id, NEW.name, NEw.size, action, NEW.has_conflict, NEW.type);

    RETURN NEW;
END;
$psql$ LANGUAGE PLPGSQL;

-- Insert
DROP TRIGGER IF EXISTS file_after_insert ON "File";
CREATE TRIGGER file_after_insert AFTER INSERT ON "File" FOR EACH ROW EXECUTE FUNCTION add_file_history('CREATED');
-- Update
DROP TRIGGER IF EXISTS file_after_update ON "File";
CREATE TRIGGER file_after_update AFTER UPDATE ON "File" FOR EACH ROW EXECUTE FUNCTION add_file_history('UPDATED');

-- Modify add_hierarchy_history function
CREATE OR REPLACE FUNCTION add_hierarchy_history() RETURNS trigger
AS $psql$
DECLARE
  action "HierarchyAction";
BEGIN
    action := TG_ARGV[0];
    IF NEW.delete_at IS NOT NULL then
        action:= 'DELETED';
    END IF;

    IF OLD.delete_at IS NOT NULL and NEW.delete_at IS NULL then
        action:= 'RECOVERED';
    END IF;

    INSERT INTO "HierarchyHistory"
        (id, "requester_id", "file_id", "hierarchy_id", "old_path", "new_path", "action", "device_id", "type") VALUES
        (uuid_generate_v4(), NEW."user_id", NEW.file_id, NEW.id, OLD.path, NEW.path, action, NEW.device_id, NEW.type);

    RETURN NEW;
END;
$psql$ LANGUAGE PLPGSQL;

DROP TRIGGER IF EXISTS user_after_insert ON "Hierarchy";
CREATE TRIGGER hierarchy_after_insert AFTER INSERT ON "Hierarchy" FOR EACH ROW EXECUTE FUNCTION add_hierarchy_history('CREATED');

DROP TRIGGER IF EXISTS user_after_update ON "Hierarchy";
CREATE TRIGGER user_after_update AFTER UPDATE ON "Hierarchy" FOR EACH ROW EXECUTE FUNCTION add_hierarchy_history('UPDATED');
