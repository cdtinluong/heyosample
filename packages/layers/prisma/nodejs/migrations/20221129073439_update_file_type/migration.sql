/*
  Warnings:

  - The values [SILVER] on the enum `FileType` will be removed. If these variants are still used in the database, this will fail.

*/
-- AlterEnum
BEGIN;
ALTER TYPE "FileType" ADD VALUE 'ANIMATOR';
COMMIT;
-- AlterEnum
BEGIN;
CREATE TYPE "FileType_new" AS ENUM ('VECTORNATOR', 'ANIMATOR', 'PRESET');
UPDATE "File" SET type='ANIMATOR' WHERE type='SILVER';
UPDATE "Hierarchy" SET type='ANIMATOR' WHERE type='SILVER';
UPDATE "FileHistory" SET type='ANIMATOR' WHERE type='SILVER';
UPDATE "HierarchyHistory" SET type='ANIMATOR' WHERE type='SILVER';
ALTER TABLE "File" ALTER COLUMN "type" TYPE "FileType_new" USING ("type"::text::"FileType_new");
ALTER TABLE "FileHistory" ALTER COLUMN "type" TYPE "FileType_new" USING ("type"::text::"FileType_new");
ALTER TABLE "Hierarchy" ALTER COLUMN "type" TYPE "FileType_new" USING ("type"::text::"FileType_new");
ALTER TABLE "HierarchyHistory" ALTER COLUMN "type" TYPE "FileType_new" USING ("type"::text::"FileType_new");
ALTER TYPE "FileType" RENAME TO "FileType_old";
ALTER TYPE "FileType_new" RENAME TO "FileType";
DROP TYPE "FileType_old";
COMMIT;
