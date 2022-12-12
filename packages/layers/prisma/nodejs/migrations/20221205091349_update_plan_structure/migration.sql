/*
  Warnings:

  - You are about to drop the column `external_id` on the `Plan` table. All the data in the column will be lost.
  - You are about to drop the column `external_id` on the `PlanHistory` table. All the data in the column will be lost.
  - You are about to drop the column `options` on the `PlanHistory` table. All the data in the column will be lost.
  - Added the required column `details` to the `UserPlan` table without a default value. This is not possible if the table is not empty.
  - Added the required column `plan_product_id` to the `UserPlan` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "Store" AS ENUM ('APP_STORE', 'STRIPE', 'AMAZON', 'MAC_APP_STORE', 'PLAY_STORE', 'PROMOTIONAL');

-- AlterTable
ALTER TABLE "Plan" DROP COLUMN "external_id",
ADD COLUMN     "advantages" VARCHAR(150)[] DEFAULT ARRAY[]::VARCHAR(150)[],
ADD COLUMN     "advantages_description" TEXT,
ADD COLUMN     "description" TEXT,
ADD COLUMN     "is_active" BOOLEAN NOT NULL DEFAULT true;

-- AlterTable
ALTER TABLE "PlanHistory" DROP COLUMN "external_id",
DROP COLUMN "options",
ADD COLUMN     "details" JSONB;

-- AlterTable
ALTER TABLE "UserPlan" ADD COLUMN     "details" JSONB NOT NULL,
ADD COLUMN     "plan_product_id" UUID NOT NULL;

-- CreateTable
CREATE TABLE "PlanProduct" (
    "id" UUID NOT NULL,
    "plan_id" UUID NOT NULL,
    "external_id" VARCHAR(150) NOT NULL,
    "store" "Store" NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PlanProduct_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PlanProductHistory" (
    "id" UUID NOT NULL,
    "plan_product_id" UUID NOT NULL,
    "details" JSONB,
    "action" "PlanAction" NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PlanProductHistory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserPlanHistory" (
    "id" UUID NOT NULL,
    "user_plan_id" UUID NOT NULL,
    "details" JSONB,
    "action" "PlanAction" NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UserPlanHistory_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PlanProduct_external_id_idx" ON "PlanProduct"("external_id");

-- CreateIndex
CREATE INDEX "PlanProduct_store_idx" ON "PlanProduct"("store");

-- CreateIndex
CREATE INDEX "PlanProduct_is_active_idx" ON "PlanProduct"("is_active");

-- CreateIndex
CREATE UNIQUE INDEX "PlanProduct_plan_id_store_is_active_key" ON "PlanProduct"("plan_id", "store", "is_active");

-- CreateIndex
CREATE INDEX "Plan_is_active_idx" ON "Plan"("is_active");

-- AddForeignKey
ALTER TABLE "PlanProduct" ADD CONSTRAINT "PlanProduct_plan_id_fkey" FOREIGN KEY ("plan_id") REFERENCES "Plan"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlanProductHistory" ADD CONSTRAINT "PlanProductHistory_plan_product_id_fkey" FOREIGN KEY ("plan_product_id") REFERENCES "PlanProduct"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserPlan" ADD CONSTRAINT "UserPlan_plan_product_id_fkey" FOREIGN KEY ("plan_product_id") REFERENCES "PlanProduct"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserPlanHistory" ADD CONSTRAINT "UserPlanHistory_user_plan_id_fkey" FOREIGN KEY ("user_plan_id") REFERENCES "UserPlan"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Triggers
CREATE OR REPLACE FUNCTION add_plan_history() 
    RETURNS TRIGGER
AS $psql$
DECLARE
  action "PlanAction";
BEGIN
    action := TG_ARGV[0];

    INSERT INTO "PlanHistory"
        (id, plan_id, details, action) VALUES
        (uuid_generate_v4(), NEW.id, to_jsonb(NEW), action);

    RETURN NEW;
END;
$psql$ LANGUAGE PLPGSQL;

-- Insert
DROP TRIGGER IF EXISTS plan_after_insert ON "Plan";
CREATE TRIGGER plan_after_insert AFTER INSERT ON "Plan" FOR EACH ROW EXECUTE FUNCTION add_plan_history('CREATED');
-- Update
DROP TRIGGER IF EXISTS plan_after_update ON "Plan";
CREATE TRIGGER plan_after_update AFTER UPDATE ON "Plan" FOR EACH ROW EXECUTE FUNCTION add_plan_history('UPDATED');


CREATE OR REPLACE FUNCTION add_plan_product_history() 
    RETURNS TRIGGER
AS $psql$
DECLARE
  action "PlanAction";
BEGIN
    action := TG_ARGV[0];

    INSERT INTO "PlanProductHistory"
        (id, plan_product_id, details, action) VALUES
        (uuid_generate_v4(), NEW.id, to_jsonb(NEW), action);

    RETURN NEW;
END;
$psql$ LANGUAGE PLPGSQL;

-- Insert
DROP TRIGGER IF EXISTS plan_product_after_insert ON "PlanProduct";
CREATE TRIGGER plan_product_after_insert AFTER INSERT ON "PlanProduct" FOR EACH ROW EXECUTE FUNCTION add_plan_product_history('CREATED');
-- Update
DROP TRIGGER IF EXISTS plan_product_after_update ON "PlanProduct";
CREATE TRIGGER plan_product_after_update AFTER UPDATE ON "PlanProduct" FOR EACH ROW EXECUTE FUNCTION add_plan_product_history('UPDATED');


CREATE OR REPLACE FUNCTION add_user_plan_history() 
    RETURNS TRIGGER
AS $psql$
DECLARE
  action "PlanAction";
BEGIN
    action := TG_ARGV[0];

    INSERT INTO "UserPlanHistory"
        (id, plan_product_id, details, action) VALUES
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

-- Insert default data for product
INSERT INTO "Plan" (id, options, description, advantages_description, advantages) VALUES 
('b3df1eb9-515f-4822-a5fd-5de9965e96b9', '{"usage":{"files":5,"editors":5,"workspaces":1,"version_history":20,"image_uploads":{"value":2,"unit":"mb"},"video_uploads":{"value":20,"unit":"mb"},"file_import":true,"video_export":{"value":720,"unit":"p"},"image_export":true,"sync_devices":true},"feature":{"templates":"basic","animation_presets":"basic","auto_trace":true,"pen_tool":true,"brush_tool":true,"share_builder":true,"brand_control":false,"ipad_optimized":false},"collaboration":{"shareable_links":true,"guest_users":true,"commenting":"basic","workspaces":5,"shared_font_management":false},"admin_security":{"workspace_administration":true,"sharing_permissions":false,"sso":false},"support":{"learning_hub":true,"support_forum":true,"standard_support":true,"priority_support":false}}', 'For individuals that want to create stunning illustrations and animations', 'Entire Linearity Suite of Design Tools.', '{"Up to 5 Linearity Files", "Shared Workspace for up to 5 Editors", "Access to free Icons, Templates and Animation Presets", "Sync across Devices", "Unlimited Guest Users", "Basic Comment Functionality", "Basic Video Export"}'),
('edabdb73-ca11-4aba-83fd-201d951cbca1', '{"usage":{"files":-1,"editors":-1,"workspaces":-1,"version_history":-1,"image_uploads":{"value":-1,"unit":"mb"},"video_uploads":{"value":-1,"unit":"mb"},"file_import":true,"video_export":{"value":-1,"unit":"p"},"image_export":true,"sync_devices":true},"feature":{"templates":"advanced","animation_presets":"advanced","auto_trace":true,"pen_tool":true,"brush_tool":true,"share_builder":true,"brand_control":false,"ipad_optimized":false},"collaboration":{"shareable_links":true,"guest_users":true,"commenting":"video_audio","workspaces":-1,"shared_font_management":false},"admin_security":{"workspace_administration":true,"sharing_permissions":true,"sso":false},"support":{"learning_hub":true,"support_forum":true,"standard_support":true,"priority_support":false}}', 'For individuals, small teams or anyone who wants to create marketing assets regularly.', 'All features of the free plan and...', '{"Unlimited Linearity Files and Workspaces", "Unlimited Editors and Version History", "Advanced Templates and Animation Presets", "Sharing Permissions", "Advanced Comment Functionality (Video & Audio)", "Advanced Video Import & Export"}'),
('eade5a4e-af38-4fb8-b3f3-059c75df1f09', '{"usage":{"files":-1,"editors":-1,"workspaces":-1,"version_history":-1,"image_uploads":{"value":-1,"unit":"mb"},"video_uploads":{"value":-1,"unit":"mb"},"file_import":true,"video_export":{"value":-1,"unit":"p"},"image_export":true,"sync_devices":true},"feature":{"templates":"advanced","animation_presets":"advanced","auto_trace":true,"pen_tool":true,"brush_tool":true,"share_builder":true,"brand_control":true,"ipad_optimized":false},"collaboration":{"shareable_links":true,"guest_users":true,"commenting":"video_audio","workspaces":-1,"shared_font_management":true},"admin_security":{"workspace_administration":true,"sharing_permissions":true,"sso":true},"support":{"learning_hub":true,"support_forum":true,"standard_support":true,"priority_support":true}}', 'All the great features of Linearity Pro but for bigger teams.', 'All features of the Pro Plan and...', '{"Brand Control", "Shared Font Management", "Org-wide custom templates", "SSO", "Extra Support"}');

INSERT INTO "PlanProduct" (id, plan_id, external_id, store) VALUES 
('9fdbbe24-c5c6-47f1-b6e6-c5ef24eb7404', 'b3df1eb9-515f-4822-a5fd-5de9965e96b9', 'rc_0000_1m_free', 'APP_STORE'),
('6ddf7c58-f952-44e0-bf56-0831b1068731', 'b3df1eb9-515f-4822-a5fd-5de9965e96b9', 'prod_MsnLFqpcvoIpFx', 'STRIPE'),
('f942186c-e5a2-41c1-905c-75b3ca2d2803', 'edabdb73-ca11-4aba-83fd-201d951cbca1', 'rc_1000_1m_pro', 'APP_STORE'),
('a501f52d-5357-4f6a-a91d-a5de86a53148', 'edabdb73-ca11-4aba-83fd-201d951cbca1', 'prod_MsnLg0EZ0il4Hy', 'STRIPE'),
('1189bd47-a765-442d-9a9f-ba976fae1752', 'eade5a4e-af38-4fb8-b3f3-059c75df1f09', 'rc_0000_1m_teams', 'APP_STORE'),
('a8874188-acfb-4a34-9f51-82086286126a', 'eade5a4e-af38-4fb8-b3f3-059c75df1f09', 'prod_MsnMk8Gs9o1VaF', 'STRIPE');
