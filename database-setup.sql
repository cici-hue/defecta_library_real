-- ============================================================
-- Document Images Table (文档图片表) - 必须先创建此表
-- ============================================================

-- 检查表是否存在，如果存在则删除（为了获得干净的表结构）
DROP TABLE IF EXISTS document_images CASCADE;
DROP TABLE IF EXISTS defect_cases CASCADE;

-- 创建 document_images 表，直接包含缺陷信息字段
CREATE TABLE document_images (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  filename VARCHAR(500) NOT NULL,
  file_key VARCHAR(500) NOT NULL,
  mime_type VARCHAR(100),
  file_size INTEGER,
  source_slide INTEGER,
  slide_text TEXT,           -- 该幻灯片的完整文字
  image_hash TEXT,
  
  -- 图片向量存储（用于图片相似度检索）
  image_embedding JSONB,     -- 图片的向量表示（1024维浮点数数组）
  
  -- 直接解析的缺陷信息（从 Case Briefing 中提取）
  materials TEXT,           -- 材料
  claim_reason TEXT,        -- 索赔原因
  style TEXT,               -- 款式
  position TEXT,            -- 缺陷位置
  defect_description TEXT,  -- 缺陷描述
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 创建索引
CREATE INDEX idx_document_images_document_id ON document_images(document_id);
CREATE INDEX idx_document_images_created_at ON document_images(created_at DESC);
CREATE INDEX idx_document_images_materials ON document_images(materials);
CREATE INDEX idx_document_images_claim_reason ON document_images(claim_reason);

-- ============================================================
-- Defect Cases Table (缺陷案例表) - 暂不使用，预留
-- ============================================================

CREATE TABLE defect_cases (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  image_id UUID REFERENCES document_images(id) ON DELETE SET NULL,
  source_slide INTEGER,

  -- 案例基本信息
  materials TEXT,
  style TEXT,
  claim_reason TEXT NOT NULL,
  defect_description TEXT,
  position TEXT,

  -- 文本向量存储（用于文本相似度检索）
  text_embedding JSONB,       -- 案例文本的向量表示（1024维浮点数数组）

  -- RCA 报告（预留字段）
  rca_root_cause TEXT,
  rca_prevention TEXT,
  rca_correction TEXT,

  -- 元数据
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_defect_cases_document_id ON defect_cases(document_id);
CREATE INDEX idx_defect_cases_image_id ON defect_cases(image_id);

-- 禁用 RLS（如果需要）
ALTER TABLE document_images DISABLE ROW LEVEL SECURITY;
ALTER TABLE defect_cases DISABLE ROW LEVEL SECURITY;
