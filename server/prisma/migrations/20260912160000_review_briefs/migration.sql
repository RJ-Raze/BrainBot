ALTER TABLE memories ADD COLUMN review_status TEXT NOT NULL DEFAULT 'legacy_unreviewed', ADD COLUMN version INTEGER NOT NULL DEFAULT 1;
ALTER TABLE memories ALTER COLUMN review_status SET DEFAULT 'draft';
CREATE TABLE memory_revisions (
 id UUID PRIMARY KEY, memory_id UUID NOT NULL REFERENCES memories(id) ON DELETE CASCADE,
 version INTEGER NOT NULL, title TEXT NOT NULL, content TEXT NOT NULL, status TEXT NOT NULL,
 actor_id UUID NOT NULL, reason TEXT, sources JSONB NOT NULL DEFAULT '[]', created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
 UNIQUE(memory_id, version)
);
CREATE TABLE meeting_briefs (
 id UUID PRIMARY KEY, project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
 request_key TEXT NOT NULL, title TEXT NOT NULL, content TEXT NOT NULL, version INTEGER NOT NULL DEFAULT 1,
 status TEXT NOT NULL DEFAULT 'draft', snapshot JSONB NOT NULL, actions JSONB NOT NULL DEFAULT '[]', edits JSONB NOT NULL DEFAULT '[]',
 created_by UUID NOT NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), published_at TIMESTAMPTZ,
 UNIQUE(project_id, request_key)
);
