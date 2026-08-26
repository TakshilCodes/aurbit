-- CreateEnum
CREATE TYPE "BugReportStatus" AS ENUM ('OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED');

-- CreateEnum
CREATE TYPE "BugReportPriority" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL');

-- CreateTable
CREATE TABLE "bug_reports" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "project_id" TEXT NOT NULL,
    "title" VARCHAR(160) NOT NULL,
    "description" TEXT NOT NULL,
    "reporter_email" VARCHAR(254),
    "page_url" VARCHAR(2048),
    "user_agent" VARCHAR(512),
    "viewport_width" INTEGER,
    "viewport_height" INTEGER,
    "status" "BugReportStatus" NOT NULL DEFAULT 'OPEN',
    "priority" "BugReportPriority" NOT NULL DEFAULT 'MEDIUM',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "bug_reports_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "bug_reports_organization_id_project_id_created_at_idx" ON "bug_reports"("organization_id", "project_id", "created_at");

-- CreateIndex
CREATE INDEX "bug_reports_project_id_created_at_idx" ON "bug_reports"("project_id", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "projects_id_organization_id_key" ON "projects"("id", "organization_id");

-- AddForeignKey
ALTER TABLE "bug_reports" ADD CONSTRAINT "bug_reports_project_id_organization_id_fkey" FOREIGN KEY ("project_id", "organization_id") REFERENCES "projects"("id", "organization_id") ON DELETE CASCADE ON UPDATE CASCADE;
