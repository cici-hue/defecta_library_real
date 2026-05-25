-- ============================================
-- Document Images Table
-- 存储从文档中提取的图片
-- ============================================

CREATE TABLE IF NOT EXISTS document_images (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
    filename VARCHAR(500) NOT NULL,
    file_key VARCHAR(500) NOT NULL,
    mime_type VARCHAR(100) NOT NULL,
    file_size INTEGER NOT NULL,
    source_slide INTEGER,
    embedding JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- 索引
CREATE INDEX IF NOT EXISTS idx_document_images_document_id ON document_images(document_id);
CREATE INDEX IF NOT EXISTS idx_document_images_source_slide ON document_images(source_slide);

-- ============================================
-- Knowledge Chunks with Image Support
-- ============================================

ALTER TABLE knowledge_chunks ADD COLUMN IF NOT EXISTS related_image_ids JSONB;

-- ============================================
-- Chat Messages with Image Support
-- ============================================

ALTER TABLE chat_messages ADD COLUMN IF NOT EXISTS user_image_key VARCHAR(500);
