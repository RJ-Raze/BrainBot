-- 同一消息只允许晋升一次共享记忆：source_msg_id 加唯一约束，兜底并发晋升竞态。
-- 注意：若历史数据已存在同一 source_msg_id 多条记忆，需先人工去重再执行本迁移。
CREATE UNIQUE INDEX "memories_source_msg_id_key" ON "memories"("source_msg_id");
