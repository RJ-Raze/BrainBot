-- Bring the committed migrations in sync with the current Project and Role models.
ALTER TABLE "projects" ADD COLUMN "invite_code" VARCHAR(16);
ALTER TABLE "projects" ALTER COLUMN "status" SET DEFAULT 0;
ALTER TABLE "roles" ADD COLUMN "member_name" VARCHAR(64);
CREATE UNIQUE INDEX "projects_invite_code_key" ON "projects"("invite_code");
