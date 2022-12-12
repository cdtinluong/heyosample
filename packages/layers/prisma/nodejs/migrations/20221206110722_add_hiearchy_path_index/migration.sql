-- AlterTable
ALTER TABLE "Plan" ALTER COLUMN "advantages" SET DEFAULT ARRAY[]::VARCHAR(150)[];

-- CreateIndex
CREATE INDEX "Hierarchy_path_idx" ON "Hierarchy"("path");
