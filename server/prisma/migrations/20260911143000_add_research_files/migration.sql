-- CreateTable
CREATE TABLE "research_files" (
    "id" UUID NOT NULL,
    "project_id" UUID NOT NULL,
    "uploaded_by" UUID NOT NULL,
    "original_name" VARCHAR(255) NOT NULL,
    "stored_name" VARCHAR(255) NOT NULL,
    "mime_type" VARCHAR(128) NOT NULL,
    "extension" VARCHAR(16) NOT NULL,
    "size_bytes" INTEGER NOT NULL,
    "content_hash" VARCHAR(64) NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "research_files_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "research_files_project_id_content_hash_key" ON "research_files"("project_id", "content_hash");

-- CreateIndex
CREATE INDEX "research_files_project_id_created_at_idx" ON "research_files"("project_id", "created_at" DESC);

-- CreateIndex
CREATE INDEX "research_files_uploaded_by_idx" ON "research_files"("uploaded_by");

-- AddForeignKey
ALTER TABLE "research_files" ADD CONSTRAINT "research_files_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "research_files" ADD CONSTRAINT "research_files_uploaded_by_fkey" FOREIGN KEY ("uploaded_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
