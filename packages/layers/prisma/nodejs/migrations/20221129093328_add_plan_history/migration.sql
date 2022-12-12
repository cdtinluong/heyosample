-- CreateEnum
CREATE TYPE "PlanAction" AS ENUM ('CREATED', 'UPDATED', 'DELETED');

-- CreateTable
CREATE TABLE "PlanHistory" (
    "id" UUID NOT NULL,
    "plan_id" UUID NOT NULL,
    "external_id" VARCHAR(150) NOT NULL,
    "options" JSONB NOT NULL,
    "action" "PlanAction" NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PlanHistory_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "PlanHistory" ADD CONSTRAINT "PlanHistory_plan_id_fkey" FOREIGN KEY ("plan_id") REFERENCES "Plan"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE OR REPLACE FUNCTION add_plan_history() 
    RETURNS TRIGGER
AS $psql$
DECLARE
  action "PlanAction";
BEGIN
    action := TG_ARGV[0];

    IF NEW.delete_at IS NOT NULL then
        action := 'DELETED';
    END IF;

    INSERT INTO "PlanHistory"
        (id, plan_id, external_id, options, action) VALUES
        (uuid_generate_v4(), NEW.id, NEW.external_id, NEW.options, action);

    RETURN NEW;
END;
$psql$ LANGUAGE PLPGSQL;

-- Insert
DROP TRIGGER IF EXISTS plan_after_insert ON "Plan";
CREATE TRIGGER plan_after_insert AFTER INSERT ON "Plan" FOR EACH ROW EXECUTE FUNCTION add_plan_history('CREATED');

-- Update
DROP TRIGGER IF EXISTS plan_after_update ON "Plan";
CREATE TRIGGER plan_after_update AFTER UPDATE ON "Plan" FOR EACH ROW EXECUTE FUNCTION add_plan_history('UPDATED');
