-- ============================================
-- 修复 Row Level Security (RLS) 问题
-- 在 Supabase SQL Editor 中执行
-- ============================================

-- 方式一：禁用所有表的 RLS（开发测试环境推荐）
ALTER TABLE documents DISABLE ROW LEVEL SECURITY;
ALTER TABLE document_extractions DISABLE ROW LEVEL SECURITY;
ALTER TABLE knowledge_schemas DISABLE ROW LEVEL SECURITY;
ALTER TABLE knowledge_chunks DISABLE ROW LEVEL SECURITY;
ALTER TABLE chat_sessions DISABLE ROW LEVEL SECURITY;
ALTER TABLE chat_messages DISABLE ROW LEVEL SECURITY;

-- 方式二：启用 RLS 但允许匿名访问（生产环境可选）
-- 如果需要启用 RLS，取消下面的注释并执行：

-- ALTER TABLE documents ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE document_extractions ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE knowledge_schemas ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE knowledge_chunks ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE chat_sessions ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE chat_messages ENABLE ROW LEVEL SECURITY;

-- -- 允许匿名用户进行所有操作（开发测试用）
-- CREATE POLICY "Allow anonymous access" ON documents FOR ALL USING (true) WITH CHECK (true);
-- CREATE POLICY "Allow anonymous access" ON document_extractions FOR ALL USING (true) WITH CHECK (true);
-- CREATE POLICY "Allow anonymous access" ON knowledge_schemas FOR ALL USING (true) WITH CHECK (true);
-- CREATE POLICY "Allow anonymous access" ON knowledge_chunks FOR ALL USING (true) WITH CHECK (true);
-- CREATE POLICY "Allow anonymous access" ON chat_sessions FOR ALL USING (true) WITH CHECK (true);
-- CREATE POLICY "Allow anonymous access" ON chat_messages FOR ALL USING (true) WITH CHECK (true);

-- 验证 RLS 状态
SELECT 
    schemaname,
    tablename,
    rowsecurity
FROM pg_tables
WHERE tablename IN ('documents', 'document_extractions', 'knowledge_schemas', 'knowledge_chunks', 'chat_sessions', 'chat_messages');
