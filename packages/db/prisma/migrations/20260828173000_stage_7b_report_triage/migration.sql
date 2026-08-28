-- AlterTable
ALTER TABLE "bug_reports" ADD COLUMN "assignee_member_id" TEXT;

-- CreateTable
CREATE TABLE "internal_notes" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "bug_report_id" TEXT NOT NULL,
    "author_id" TEXT NOT NULL,
    "body" VARCHAR(4000) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "internal_notes_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "bug_reports_id_organization_id_key" ON "bug_reports"("id", "organization_id");

-- CreateIndex
CREATE INDEX "bug_reports_assignee_member_id_idx" ON "bug_reports"("assignee_member_id");

-- CreateIndex
CREATE INDEX "internal_notes_organization_id_bug_report_id_created_at_idx" ON "internal_notes"("organization_id", "bug_report_id", "created_at");

-- CreateIndex
CREATE INDEX "internal_notes_author_id_idx" ON "internal_notes"("author_id");

-- AddForeignKey
ALTER TABLE "bug_reports" ADD CONSTRAINT "bug_reports_assignee_member_id_fkey" FOREIGN KEY ("assignee_member_id") REFERENCES "organization_members"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "internal_notes" ADD CONSTRAINT "internal_notes_bug_report_id_fkey" FOREIGN KEY ("bug_report_id", "organization_id") REFERENCES "bug_reports"("id", "organization_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "internal_notes" ADD CONSTRAINT "internal_notes_author_id_fkey" FOREIGN KEY ("author_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
