CREATE TABLE "team_messages" (
  "seq" BIGSERIAL PRIMARY KEY,
  "request_id" UUID NOT NULL UNIQUE,
  "project_id" UUID NOT NULL REFERENCES "projects"("id") ON DELETE CASCADE,
  "sender_id" UUID NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "content" VARCHAR(5000) NOT NULL,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX "team_messages_project_id_seq_idx" ON "team_messages"("project_id", "seq");
CREATE INDEX "team_messages_project_id_sender_id_created_at_idx" ON "team_messages"("project_id", "sender_id", "created_at");
