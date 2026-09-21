ALTER TABLE "paper_cards"
  ADD COLUMN "evidence_quote" TEXT,
  ADD COLUMN "evidence_locator" VARCHAR(255),
  ADD COLUMN "evidence_status" VARCHAR(16) NOT NULL DEFAULT 'unverified';

CREATE INDEX "paper_cards_project_evidence_status_idx"
  ON "paper_cards"("project_id", "evidence_status");
