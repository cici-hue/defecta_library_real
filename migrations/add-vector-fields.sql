-- ============================================================
-- Migration: 添加向量存储字段
-- 用于支持图片相似度检索和文本相似度检索
-- ============================================================

-- 1. 为 document_images 表添加图片向量字段
ALTER TABLE document_images 
ADD COLUMN IF NOT EXISTS image_embedding JSONB;

COMMENT ON COLUMN document_images.image_embedding IS '图片的向量表示（1024维浮点数数组），用于图片相似度检索';

-- 2. 为 defect_cases 表添加文本向量字段
ALTER TABLE defect_cases 
ADD COLUMN IF NOT EXISTS text_embedding JSONB;

COMMENT ON COLUMN defect_cases.text_embedding IS '案例文本的向量表示（1024维浮点数数组），用于文本相似度检索';

-- 3. 创建向量索引（使用 pgvector 扩展，如果已安装）
-- 注意：需要先安装 pgvector 扩展才能使用这些索引
-- CREATE EXTENSION IF NOT EXISTS vector;
-- 
-- 如果安装了 pgvector，可以创建以下索引：
-- ALTER TABLE document_images ADD COLUMN image_vector vector(1024);
-- ALTER TABLE defect_cases ADD COLUMN text_vector vector(1024);
-- CREATE INDEX idx_document_images_image_embedding ON document_images USING ivfflat (image_vector vector_cosine_ops);
-- CREATE INDEX idx_defect_cases_text_embedding ON defect_cases USING ivfflat (text_vector vector_cosine_ops);

-- 4. 创建 GIN 索引用于 JSONB 字段查询优化
CREATE INDEX IF NOT EXISTS idx_document_images_image_embedding_gin ON document_images USING gin (image_embedding);
CREATE INDEX IF NOT EXISTS idx_defect_cases_text_embedding_gin ON defect_cases USING gin (text_embedding);

-- 完成
SELECT 'Migration completed: Vector storage fields added successfully' as result;
