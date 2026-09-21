-- CreateTable
CREATE TABLE "users" (
    "id" UUID NOT NULL,
    "username" VARCHAR(64) NOT NULL,
    "password_hash" VARCHAR(255) NOT NULL,
    "email" VARCHAR(128),
    "display_name" VARCHAR(64),
    "avatar_url" TEXT,
    "status" SMALLINT NOT NULL DEFAULT 1,
    "last_login_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "projects" (
    "id" UUID NOT NULL,
    "name" VARCHAR(128) NOT NULL,
    "description" TEXT,
    "domain" VARCHAR(64),
    "cover_url" TEXT,
    "status" SMALLINT NOT NULL DEFAULT 1,
    "owner_id" UUID NOT NULL,
    "settings" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "projects_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "roles" (
    "id" UUID NOT NULL,
    "project_id" UUID NOT NULL,
    "name" VARCHAR(64) NOT NULL,
    "description" TEXT,
    "system_prompt" TEXT NOT NULL,
    "llm_config" JSONB NOT NULL DEFAULT '{}',
    "temp_limit" DOUBLE PRECISION,
    "color" VARCHAR(16),
    "icon" VARCHAR(32),
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "is_archived" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "roles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "project_members" (
    "id" UUID NOT NULL,
    "project_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "role_id" UUID NOT NULL,
    "is_leader" BOOLEAN NOT NULL DEFAULT false,
    "joined_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "project_members_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "conversations" (
    "id" UUID NOT NULL,
    "project_id" UUID NOT NULL,
    "role_id" UUID NOT NULL,
    "title" VARCHAR(255) NOT NULL,
    "context_type" VARCHAR(32) NOT NULL DEFAULT 'general',
    "context_ref_id" UUID,
    "message_count" INTEGER NOT NULL DEFAULT 0,
    "last_message_at" TIMESTAMPTZ(6),
    "is_pinned" BOOLEAN NOT NULL DEFAULT false,
    "is_archived" BOOLEAN NOT NULL DEFAULT false,
    "created_by" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "conversations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "messages" (
    "id" UUID NOT NULL,
    "conversation_id" UUID NOT NULL,
    "project_id" UUID NOT NULL,
    "role_id" UUID NOT NULL,
    "sender_type" VARCHAR(16) NOT NULL,
    "sender_user_id" UUID,
    "content" TEXT NOT NULL,
    "token_in" INTEGER NOT NULL DEFAULT 0,
    "token_out" INTEGER NOT NULL DEFAULT 0,
    "llm_call_id" UUID,
    "attachments" JSONB NOT NULL DEFAULT '[]',
    "meta" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "messages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "memories" (
    "id" UUID NOT NULL,
    "project_id" UUID NOT NULL,
    "category" VARCHAR(32) NOT NULL,
    "title" VARCHAR(255) NOT NULL,
    "content" TEXT NOT NULL,
    "source_role_id" UUID,
    "source_user_id" UUID,
    "source_msg_id" UUID,
    "creator_rid" VARCHAR(64),
    "source_conversation_id" VARCHAR(64),
    "source_message_range" JSONB,
    "tags" TEXT[],
    "importance" SMALLINT NOT NULL DEFAULT 3,
    "is_pinned" BOOLEAN NOT NULL DEFAULT false,
    "promoted_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "memories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tasks" (
    "id" UUID NOT NULL,
    "project_id" UUID NOT NULL,
    "parent_id" UUID,
    "role_id" UUID,
    "title" VARCHAR(255) NOT NULL,
    "description" TEXT,
    "task_type" VARCHAR(32) NOT NULL DEFAULT 'general',
    "status" VARCHAR(16) NOT NULL DEFAULT 'todo',
    "priority" SMALLINT NOT NULL DEFAULT 3,
    "assignee_id" UUID,
    "due_date" DATE,
    "progress" SMALLINT NOT NULL DEFAULT 0,
    "meta" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "completed_at" TIMESTAMPTZ(6),

    CONSTRAINT "tasks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "documents" (
    "id" UUID NOT NULL,
    "project_id" UUID NOT NULL,
    "parent_id" UUID,
    "title" VARCHAR(255) NOT NULL,
    "content" TEXT NOT NULL DEFAULT '',
    "doc_type" VARCHAR(32) NOT NULL DEFAULT 'note',
    "is_auto_synced" BOOLEAN NOT NULL DEFAULT true,
    "last_editor_id" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "documents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "work_products" (
    "id" UUID NOT NULL,
    "project_id" UUID NOT NULL,
    "role_id" UUID NOT NULL,
    "task_id" UUID,
    "product_type" VARCHAR(32) NOT NULL,
    "title" VARCHAR(255) NOT NULL,
    "description" TEXT,
    "file_url" TEXT,
    "preview" TEXT,
    "meta" JSONB NOT NULL DEFAULT '{}',
    "created_by" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "work_products_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "llm_calls" (
    "id" UUID NOT NULL,
    "project_id" UUID NOT NULL,
    "role_id" UUID NOT NULL,
    "user_id" UUID,
    "model_name" VARCHAR(64) NOT NULL,
    "prompt_tokens" INTEGER NOT NULL DEFAULT 0,
    "completion_tokens" INTEGER NOT NULL DEFAULT 0,
    "total_tokens" INTEGER NOT NULL DEFAULT 0,
    "cost_cny" DECIMAL(10,4) NOT NULL DEFAULT 0,
    "latency_ms" INTEGER NOT NULL DEFAULT 0,
    "status" VARCHAR(16) NOT NULL DEFAULT 'success',
    "error_msg" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "llm_calls_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "papers" (
    "id" UUID NOT NULL,
    "project_id" UUID,
    "source" VARCHAR(32) NOT NULL,
    "external_id" VARCHAR(128) NOT NULL,
    "title" TEXT NOT NULL,
    "authors" JSONB NOT NULL DEFAULT '[]',
    "abstract" TEXT,
    "year" INTEGER,
    "venue" VARCHAR(255),
    "doi" VARCHAR(128),
    "pdf_url" TEXT,
    "code_url" TEXT,
    "keywords" TEXT[],
    "citation_count" INTEGER NOT NULL DEFAULT 0,
    "raw_meta" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "papers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "paper_cards" (
    "id" UUID NOT NULL,
    "project_id" UUID NOT NULL,
    "paper_id" UUID NOT NULL,
    "role_id" UUID NOT NULL,
    "author_user_id" UUID NOT NULL,
    "notes" TEXT,
    "tags" TEXT[],
    "is_shared" BOOLEAN NOT NULL DEFAULT false,
    "rating" SMALLINT NOT NULL DEFAULT 3,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "paper_cards_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "direction_nodes" (
    "id" UUID NOT NULL,
    "project_id" UUID NOT NULL,
    "parent_id" UUID,
    "root_task_id" UUID,
    "name" VARCHAR(255) NOT NULL,
    "description" TEXT,
    "feasibility" SMALLINT,
    "novelty" SMALLINT,
    "impact" SMALLINT,
    "evidence_count" INTEGER NOT NULL DEFAULT 0,
    "status" VARCHAR(16) NOT NULL DEFAULT 'exploring',
    "created_by" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "direction_nodes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "decomp_results" (
    "id" UUID NOT NULL,
    "project_id" UUID NOT NULL,
    "root_task_id" UUID NOT NULL,
    "role_id" UUID NOT NULL,
    "input_text" TEXT NOT NULL,
    "sub_questions" JSONB NOT NULL DEFAULT '[]',
    "methodology" TEXT,
    "deliverables" JSONB NOT NULL DEFAULT '[]',
    "risks" JSONB NOT NULL DEFAULT '[]',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "decomp_results_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "experiments" (
    "id" UUID NOT NULL,
    "project_id" UUID NOT NULL,
    "role_id" UUID NOT NULL,
    "task_id" UUID,
    "direction_id" UUID,
    "title" VARCHAR(255) NOT NULL,
    "hypothesis" TEXT,
    "setup" TEXT,
    "result" TEXT,
    "metric" JSONB NOT NULL DEFAULT '{}',
    "conclusion" TEXT,
    "log_url" TEXT,
    "status" VARCHAR(16) NOT NULL DEFAULT 'planned',
    "run_at" TIMESTAMPTZ(6),
    "created_by" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "experiments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "search_tasks" (
    "id" UUID NOT NULL,
    "project_id" UUID NOT NULL,
    "query" TEXT NOT NULL,
    "sources" TEXT[] DEFAULT ARRAY['arxiv', 'openalex']::TEXT[],
    "status" VARCHAR(16) NOT NULL DEFAULT 'pending',
    "result" JSONB,
    "error_msg" TEXT,
    "created_by" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finished_at" TIMESTAMPTZ(6),

    CONSTRAINT "search_tasks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "task_references" (
    "id" UUID NOT NULL,
    "task_id" UUID NOT NULL,
    "ref_type" VARCHAR(16) NOT NULL,
    "ref_id" UUID NOT NULL,
    "note" TEXT,
    "created_by" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "task_references_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_username_key" ON "users"("username");

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE INDEX "projects_owner_id_idx" ON "projects"("owner_id");

-- CreateIndex
CREATE INDEX "projects_status_idx" ON "projects"("status");

-- CreateIndex
CREATE INDEX "roles_project_id_idx" ON "roles"("project_id");

-- CreateIndex
CREATE UNIQUE INDEX "roles_project_id_name_key" ON "roles"("project_id", "name");

-- CreateIndex
CREATE INDEX "project_members_project_id_idx" ON "project_members"("project_id");

-- CreateIndex
CREATE INDEX "project_members_user_id_idx" ON "project_members"("user_id");

-- CreateIndex
CREATE INDEX "project_members_role_id_idx" ON "project_members"("role_id");

-- CreateIndex
CREATE UNIQUE INDEX "project_members_project_id_user_id_role_id_key" ON "project_members"("project_id", "user_id", "role_id");

-- CreateIndex
CREATE INDEX "conversations_project_id_role_id_idx" ON "conversations"("project_id", "role_id");

-- CreateIndex
CREATE INDEX "conversations_context_type_context_ref_id_idx" ON "conversations"("context_type", "context_ref_id");

-- CreateIndex
CREATE INDEX "conversations_last_message_at_idx" ON "conversations"("last_message_at" DESC);

-- CreateIndex
CREATE INDEX "messages_conversation_id_created_at_idx" ON "messages"("conversation_id", "created_at");

-- CreateIndex
CREATE INDEX "messages_role_id_idx" ON "messages"("role_id");

-- CreateIndex
CREATE INDEX "messages_project_id_idx" ON "messages"("project_id");

-- CreateIndex
CREATE INDEX "memories_project_id_category_idx" ON "memories"("project_id", "category");

-- CreateIndex
CREATE INDEX "tasks_project_id_status_idx" ON "tasks"("project_id", "status");

-- CreateIndex
CREATE INDEX "tasks_role_id_idx" ON "tasks"("role_id");

-- CreateIndex
CREATE INDEX "tasks_parent_id_idx" ON "tasks"("parent_id");

-- CreateIndex
CREATE INDEX "documents_project_id_idx" ON "documents"("project_id");

-- CreateIndex
CREATE INDEX "documents_parent_id_idx" ON "documents"("parent_id");

-- CreateIndex
CREATE INDEX "work_products_project_id_product_type_idx" ON "work_products"("project_id", "product_type");

-- CreateIndex
CREATE INDEX "work_products_role_id_idx" ON "work_products"("role_id");

-- CreateIndex
CREATE INDEX "llm_calls_project_id_created_at_idx" ON "llm_calls"("project_id", "created_at");

-- CreateIndex
CREATE INDEX "llm_calls_role_id_idx" ON "llm_calls"("role_id");

-- CreateIndex
CREATE INDEX "papers_project_id_idx" ON "papers"("project_id");

-- CreateIndex
CREATE INDEX "papers_year_idx" ON "papers"("year");

-- CreateIndex
CREATE UNIQUE INDEX "papers_source_external_id_key" ON "papers"("source", "external_id");

-- CreateIndex
CREATE INDEX "paper_cards_project_id_paper_id_idx" ON "paper_cards"("project_id", "paper_id");

-- CreateIndex
CREATE INDEX "paper_cards_role_id_idx" ON "paper_cards"("role_id");

-- CreateIndex
CREATE INDEX "direction_nodes_project_id_idx" ON "direction_nodes"("project_id");

-- CreateIndex
CREATE INDEX "direction_nodes_parent_id_idx" ON "direction_nodes"("parent_id");

-- CreateIndex
CREATE INDEX "direction_nodes_project_id_status_idx" ON "direction_nodes"("project_id", "status");

-- CreateIndex
CREATE INDEX "decomp_results_project_id_idx" ON "decomp_results"("project_id");

-- CreateIndex
CREATE INDEX "decomp_results_root_task_id_idx" ON "decomp_results"("root_task_id");

-- CreateIndex
CREATE INDEX "experiments_project_id_idx" ON "experiments"("project_id");

-- CreateIndex
CREATE INDEX "experiments_direction_id_idx" ON "experiments"("direction_id");

-- CreateIndex
CREATE INDEX "search_tasks_project_id_status_idx" ON "search_tasks"("project_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "task_references_task_id_ref_type_ref_id_key" ON "task_references"("task_id", "ref_type", "ref_id");

-- AddForeignKey
ALTER TABLE "projects" ADD CONSTRAINT "projects_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "roles" ADD CONSTRAINT "roles_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_members" ADD CONSTRAINT "project_members_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_members" ADD CONSTRAINT "project_members_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_members" ADD CONSTRAINT "project_members_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "roles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "conversations" ADD CONSTRAINT "conversations_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "conversations" ADD CONSTRAINT "conversations_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "roles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "conversations" ADD CONSTRAINT "conversations_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "messages" ADD CONSTRAINT "messages_conversation_id_fkey" FOREIGN KEY ("conversation_id") REFERENCES "conversations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "messages" ADD CONSTRAINT "messages_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "messages" ADD CONSTRAINT "messages_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "roles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "messages" ADD CONSTRAINT "messages_sender_user_id_fkey" FOREIGN KEY ("sender_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "memories" ADD CONSTRAINT "memories_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "memories" ADD CONSTRAINT "memories_source_role_id_fkey" FOREIGN KEY ("source_role_id") REFERENCES "roles"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "memories" ADD CONSTRAINT "memories_source_user_id_fkey" FOREIGN KEY ("source_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "memories" ADD CONSTRAINT "memories_source_msg_id_fkey" FOREIGN KEY ("source_msg_id") REFERENCES "messages"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "tasks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "roles"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_assignee_id_fkey" FOREIGN KEY ("assignee_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "documents" ADD CONSTRAINT "documents_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "documents" ADD CONSTRAINT "documents_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "documents"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "documents" ADD CONSTRAINT "documents_last_editor_id_fkey" FOREIGN KEY ("last_editor_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "work_products" ADD CONSTRAINT "work_products_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "work_products" ADD CONSTRAINT "work_products_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "roles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "work_products" ADD CONSTRAINT "work_products_task_id_fkey" FOREIGN KEY ("task_id") REFERENCES "tasks"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "work_products" ADD CONSTRAINT "work_products_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "llm_calls" ADD CONSTRAINT "llm_calls_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "llm_calls" ADD CONSTRAINT "llm_calls_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "roles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "llm_calls" ADD CONSTRAINT "llm_calls_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "papers" ADD CONSTRAINT "papers_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "paper_cards" ADD CONSTRAINT "paper_cards_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "paper_cards" ADD CONSTRAINT "paper_cards_paper_id_fkey" FOREIGN KEY ("paper_id") REFERENCES "papers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "paper_cards" ADD CONSTRAINT "paper_cards_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "roles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "paper_cards" ADD CONSTRAINT "paper_cards_author_user_id_fkey" FOREIGN KEY ("author_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "direction_nodes" ADD CONSTRAINT "direction_nodes_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "direction_nodes" ADD CONSTRAINT "direction_nodes_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "direction_nodes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "direction_nodes" ADD CONSTRAINT "direction_nodes_root_task_id_fkey" FOREIGN KEY ("root_task_id") REFERENCES "tasks"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "direction_nodes" ADD CONSTRAINT "direction_nodes_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "decomp_results" ADD CONSTRAINT "decomp_results_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "decomp_results" ADD CONSTRAINT "decomp_results_root_task_id_fkey" FOREIGN KEY ("root_task_id") REFERENCES "tasks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "decomp_results" ADD CONSTRAINT "decomp_results_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "roles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "experiments" ADD CONSTRAINT "experiments_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "experiments" ADD CONSTRAINT "experiments_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "roles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "experiments" ADD CONSTRAINT "experiments_task_id_fkey" FOREIGN KEY ("task_id") REFERENCES "tasks"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "experiments" ADD CONSTRAINT "experiments_direction_id_fkey" FOREIGN KEY ("direction_id") REFERENCES "direction_nodes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "experiments" ADD CONSTRAINT "experiments_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "search_tasks" ADD CONSTRAINT "search_tasks_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "search_tasks" ADD CONSTRAINT "search_tasks_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "task_references" ADD CONSTRAINT "task_references_task_id_fkey" FOREIGN KEY ("task_id") REFERENCES "tasks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "task_references" ADD CONSTRAINT "task_references_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
