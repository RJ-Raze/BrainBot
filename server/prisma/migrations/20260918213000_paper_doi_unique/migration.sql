-- 同一项目内 DOI 唯一，防止同一篇论文从不同来源（arxiv/openalex/ris/manual）重复收录。
-- PostgreSQL 唯一索引允许多个 NULL，因此无 DOI 的论文不受影响。
CREATE UNIQUE INDEX "papers_project_id_doi_key" ON "papers"("project_id", "doi");
