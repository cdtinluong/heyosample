CREATE OR REPLACE FUNCTION add_user_history() 
    RETURNS TRIGGER
AS $psql$
DECLARE
  action "UserAction";
BEGIN
    action := TG_ARGV[0];

    IF NEW.delete_at IS NOT NULL then
        action := 'DELETED';
    END IF;

    IF action = 'CREATED' then
        INSERT INTO "Hierarchy"
            (id, user_id, "path", device_id, "status") VALUES
            (uuid_generate_v4(), NEW.id, '/', NEW.device_id, 'ACTIVE');
    END IF;

    INSERT INTO "UserHistory"
        (id, user_id, action, details, device_id) VALUES
        (uuid_generate_v4(), NEW.id, action, to_jsonb(NEW), NEW.device_id);

    RETURN NEW;
END;
$psql$ LANGUAGE PLPGSQL;

-- Insert
DROP TRIGGER IF EXISTS user_after_insert ON "User";
CREATE TRIGGER user_after_insert AFTER INSERT ON "User" FOR EACH ROW EXECUTE FUNCTION add_user_history('CREATED');

-- Update
DROP TRIGGER IF EXISTS user_after_update ON "User";
CREATE TRIGGER user_after_update AFTER UPDATE ON "User" FOR EACH ROW EXECUTE FUNCTION add_user_history('UPDATED');
