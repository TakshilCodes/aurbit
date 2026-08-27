-- CreateTable
CREATE TABLE "attachments" (
    "id" TEXT NOT NULL,
    "bug_report_id" TEXT NOT NULL,
    "storage_key" VARCHAR(255) NOT NULL,
    "file_name" VARCHAR(255) NOT NULL,
    "content_type" VARCHAR(100) NOT NULL,
    "size" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "attachments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "attachments_storage_key_key" ON "attachments"("storage_key");

-- CreateIndex
CREATE INDEX "attachments_bug_report_id_idx" ON "attachments"("bug_report_id");

-- AddForeignKey
ALTER TABLE "attachments" ADD CONSTRAINT "attachments_bug_report_id_fkey" FOREIGN KEY ("bug_report_id") REFERENCES "bug_reports"("id") ON DELETE CASCADE ON UPDATE CASCADE;
