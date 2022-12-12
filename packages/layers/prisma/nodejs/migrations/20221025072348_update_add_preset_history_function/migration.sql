-- AlterTable
ALTER TABLE "FileContent" ALTER COLUMN "device_id" SET DEFAULT 'no-device-id';

-- AlterTable
ALTER TABLE "Preset" ALTER COLUMN "version" SET DEFAULT '1',
ALTER COLUMN "device_id" SET DEFAULT 'no-device-id';

--UpdateTrigger
CREATE OR REPLACE FUNCTION add_preset_history() 
    RETURNS TRIGGER
AS $psql$
DECLARE
  action "PresetAction";
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
