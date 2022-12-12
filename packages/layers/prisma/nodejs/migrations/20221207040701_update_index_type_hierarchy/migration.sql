-- DropIndex
DROP INDEX "Hierarchy_path_idx";

-- AlterTable
ALTER TABLE "Plan" ALTER COLUMN "advantages" SET DEFAULT ARRAY[]::VARCHAR(150)[];

-- CreateIndex
CREATE INDEX "Hierarchy_path_idx" ON "Hierarchy" USING SPGIST ("path");

-- CreateIndex
CREATE INDEX "Hierarchy_user_id_device_id_idx" ON "Hierarchy"("user_id", "device_id");
