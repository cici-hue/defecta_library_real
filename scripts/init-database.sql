-- ============================================
-- Defect Library 数据库初始化脚本
-- 在 Supabase SQL Editor 中执行
-- ============================================

-- 创建文档表
CREATE TABLE IF NOT EXISTS documents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    filename VARCHAR(500) NOT NULL,
    file_key VARCHAR(500) NOT NULL,
    file_type VARCHAR(50) NOT NULL,
    file_size INTEGER NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'pending',
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ
);

-- 创建文档提取结果表
CREATE TABLE IF NOT EXISTS document_extractions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
    extraction_result JSONB NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- 创建知识体系表
CREATE TABLE IF NOT EXISTS knowledge_schemas (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    schema_description TEXT NOT NULL,
    schema_structure JSONB NOT NULL,
    version INTEGER NOT NULL DEFAULT 1,
    is_active VARCHAR(10) NOT NULL DEFAULT 'true',
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- 创建知识块表
CREATE TABLE IF NOT EXISTS knowledge_chunks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    chunk_text TEXT NOT NULL,
    metadata JSONB,
    source_document_ids JSONB,
    related_chunk_ids JSONB,
    embedding JSONB,
    knowledge_schema_id UUID REFERENCES knowledge_schemas(id),
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- 创建对话会话表
CREATE TABLE IF NOT EXISTS chat_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title VARCHAR(500),
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ
);

-- 创建对话消息表
CREATE TABLE IF NOT EXISTS chat_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID NOT NULL REFERENCES chat_sessions(id) ON DELETE CASCADE,
    role VARCHAR(20) NOT NULL,
    content TEXT NOT NULL,
    sources JSONB,
    intent_result JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- 创建健康检查表
CREATE TABLE IF NOT EXISTS health_check (
    id SERIAL PRIMARY KEY,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_documents_status ON documents(status);
CREATE INDEX IF NOT EXISTS idx_documents_created_at ON documents(created_at);
CREATE INDEX IF NOT EXISTS idx_document_extractions_document_id ON document_extractions(document_id);
CREATE INDEX IF NOT EXISTS idx_knowledge_schemas_is_active ON knowledge_schemas(is_active);
CREATE INDEX IF NOT EXISTS idx_knowledge_chunks_schema_id ON knowledge_chunks(knowledge_schema_id);
CREATE INDEX IF NOT EXISTS idx_chat_sessions_created_at ON chat_sessions(created_at);
CREATE INDEX IF NOT EXISTS idx_chat_messages_session_id ON chat_messages(session_id);
CREATE INDEX IF NOT EXISTS idx_chat_messages_created_at ON chat_messages(created_at);

-- 插入初始健康检查记录
INSERT INTO health_check (id) VALUES (1) ON CONFLICT DO NOTHING;

-- 启用 RLS (Row Level Security) - 可选
-- ALTER TABLE documents ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE document_extractions ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE knowledge_schemas ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE knowledge_chunks ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE chat_sessions ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE chat_messages ENABLE ROW LEVEL SECURITY;
