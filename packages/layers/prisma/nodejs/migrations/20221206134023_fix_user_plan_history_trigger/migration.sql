CREATE OR REPLACE FUNCTION add_user_plan_history() 
    RETURNS TRIGGER
AS $psql$
DECLARE
  action "PlanAction";
BEGIN
    action := TG_ARGV[0];

    INSERT INTO "UserPlanHistory"
        (id, user_plan_id, details, action) VALUES
        (uuid_generate_v4(), NEW.id, to_jsonb(NEW), action);

    RETURN NEW;
END;
$psql$ LANGUAGE PLPGSQL;

-- Insert
DROP TRIGGER IF EXISTS user_plan_after_insert ON "UserPlan";
CREATE TRIGGER user_plan_after_insert AFTER INSERT ON "UserPlan" FOR EACH ROW EXECUTE FUNCTION add_user_plan_history('CREATED');
-- Update
DROP TRIGGER IF EXISTS user_plan_after_update ON "UserPlan";
CREATE TRIGGER user_plan_after_update AFTER UPDATE ON "UserPlan" FOR EACH ROW EXECUTE FUNCTION add_user_plan_history('UPDATED');