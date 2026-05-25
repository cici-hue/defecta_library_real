-- ============================================================
-- Document Images Table (文档图片表)
-- ============================================================

CREATE TABLE IF NOT EXISTS document_images (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  filename VARCHAR(500) NOT NULL,
  file_key VARCHAR(500) NOT NULL,
  mime_type VARCHAR(100),
  file_size INTEGER,
  source_slide INTEGER,
  image_hash TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_document_images_document_id ON document_images(document_id);
CREATE INDEX IF NOT EXISTS idx_document_images_created_at ON document_images(created_at DESC);

-- ============================================================
-- Defect Cases Table (缺陷案例表)
-- ============================================================

CREATE TABLE IF NOT EXISTS defect_cases (
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

  -- RCA 报告（预留字段）
  rca_root_cause TEXT,
  rca_prevention TEXT,
  rca_correction TEXT,

  -- Embedding（用于搜索）
  embedding JSONB,

  -- 元数据
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 索引
CREATE INDEX IF NOT EXISTS idx_defect_cases_document_id ON defect_cases(document_id);
CREATE INDEX IF NOT EXISTS idx_defect_cases_image_id ON defect_cases(image_id);
CREATE INDEX IF NOT EXISTS idx_defect_cases_created_at ON defect_cases(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_defect_cases_materials ON defect_cases(materials);
CREATE INDEX IF NOT EXISTS idx_defect_cases_claim_reason ON defect_cases(claim_reason);

-- 触发器：自动更新 updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_defect_cases_updated_at ON defect_cases;
CREATE TRIGGER update_defect_cases_updated_at
  BEFORE UPDATE ON defect_cases
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================================
-- 视图：案例与图片关联
-- ============================================================

CREATE OR REPLACE VIEW defect_cases_with_images AS
SELECT
  dc.*,
  di.filename AS image_filename,
  di.file_key AS image_file_key,
  di.mime_type AS image_mime_type,
  di.file_size AS image_file_size,
  d.filename AS document_filename
FROM defect_cases dc
LEFT JOIN document_images di ON dc.image_id = di.id
LEFT JOIN documents d ON dc.document_id = d.id;
