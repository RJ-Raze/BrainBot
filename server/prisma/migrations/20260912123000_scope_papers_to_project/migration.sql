DROP INDEX IF EXISTS "papers_source_external_id_key";

CREATE UNIQUE INDEX "papers_project_id_source_external_id_key"
  ON "papers"("project_id", "source", "external_id");

CREATE INDEX "papers_source_external_id_idx"
  ON "papers"("source", "external_id");
