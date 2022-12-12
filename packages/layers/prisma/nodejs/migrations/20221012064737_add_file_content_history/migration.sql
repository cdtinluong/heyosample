/*
  Warnings:

  - Added the required column `device_id` to the `FileContent` table without a default value. This is not possible if the table is not empty.

*/

-- AlterTable
ALTER TABLE "File" DROP COLUMN "version";

-- AlterTable
ALTER TABLE "FileContent" ADD COLUMN     "version" VARCHAR(255) DEFAULT '1' NOT NULL;

-- AlterTable
ALTER TABLE "FileContent" ADD COLUMN     "device_id" VARCHAR(100) DEFAULT 'no-device' NOT NULL;

-- AlterTable
ALTER TABLE "FileHistory" DROP COLUMN "version";

-- AddConstraint

ALTER TABLE "FileContent" ADD CONSTRAINT "FileContent_file_id_name_key" UNIQUE ("file_id", "name");

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
        (id, "file_id", "user_id", "device_id", "name", "size", "action", "has_conflict") VALUES
        (uuid_generate_v4(), NEW.id, NEW.user_id, NEW.device_id, NEW.name, NEw.size, action, NEW.has_conflict);

    RETURN NEW;
END;
$psql$ LANGUAGE PLPGSQL;

-- Insert
DROP TRIGGER IF EXISTS user_after_insert ON "File";
CREATE TRIGGER file_after_insert AFTER INSERT ON "File" FOR EACH ROW EXECUTE FUNCTION add_file_history('CREATED');

-- Update
DROP TRIGGER IF EXISTS user_after_update ON "File";
CREATE TRIGGER file_after_update AFTER UPDATE ON "File" FOR EACH ROW EXECUTE FUNCTION add_file_history('UPDATED');

-- CreateTable
CREATE TABLE "FileContentHistory" (
    "id" UUID NOT NULL,
    "file_id" UUID NOT NULL,
    "file_content_id" UUID NOT NULL,
    "device_id" VARCHAR(100) NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "version" VARCHAR(255) NOT NULL,
    "size" BIGINT NOT NULL,
    "action" "FileAction" NOT NULL,
    "status" "FileStatus" NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FileContentHistory_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "FileContentHistory" ADD CONSTRAINT "FileContentHistory_file_content_id_fkey" FOREIGN KEY ("file_content_id") REFERENCES "FileContent"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FileContentHistory" ADD CONSTRAINT "FileContentHistory_file_id_fkey" FOREIGN KEY ("file_id") REFERENCES "File"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Add add_file_content_history function
CREATE OR REPLACE FUNCTION add_file_content_history() RETURNS trigger
AS $psql$
DECLARE
  action "FileAction";
BEGIN
    action := TG_ARGV[0];

    INSERT INTO "FileContentHistory"
        (id, "file_id", "file_content_id", "device_id", "name", "size", "version", "action", "status") VALUES
        (uuid_generate_v4(), NEW.file_id, NEW.id, NEW.device_id, NEW.name, NEw.size, NEW.version, action, NEW.status);

    RETURN NEW;
END;
$psql$ LANGUAGE PLPGSQL;

-- Insert
DROP TRIGGER IF EXISTS file_content_after_insert ON "FileContent";
CREATE TRIGGER file_content_after_insert AFTER INSERT ON "FileContent" FOR EACH ROW EXECUTE FUNCTION add_file_content_history('CREATED');

-- Update
DROP TRIGGER IF EXISTS file_content_after_update ON "FileContent";
CREATE TRIGGER file_content_after_update AFTER UPDATE ON "FileContent" FOR EACH ROW EXECUTE FUNCTION add_file_content_history('UPDATED');
