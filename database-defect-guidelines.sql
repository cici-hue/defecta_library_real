-- ============================================================
-- Defect Guidelines Table (缺陷管控指南表)
-- 用于存储缺陷类型的预防措施、生产管控建议等
-- ============================================================

CREATE TABLE IF NOT EXISTS defect_guidelines (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  
  -- 分类信息
  claim_reason VARCHAR(200) NOT NULL,
  materials JSONB,  -- 适用材料列表, e.g., ["Polyamide", "Nylon", "Cotton"]
  
  -- 核心内容
  root_causes JSONB,           -- 常见原因, e.g., ["织造张力不均匀", "后整理摩擦过大"]
  prevention_measures JSONB,   -- 预防措施, e.g., ["定期校准织机张力", "使用平滑导布辊"]
  process_controls JSONB,      -- 生产流程控制点
  quality_checkpoints JSONB,   -- 质检要点
  
  -- 关联信息
  related_defect_types JSONB,  -- 相关缺陷类型, e.g., ["抽丝", "起球", "破洞"]
  risk_level VARCHAR(20),     -- 风险等级: high / medium / low
  
  -- 来源信息
  source_document_id UUID REFERENCES documents(id) ON DELETE SET NULL,
  source_type VARCHAR(50) NOT NULL DEFAULT 'auto_generated',  -- auto_generated / manual / external
  
  -- 状态管理
  status VARCHAR(20) NOT NULL DEFAULT 'draft',   -- draft / published / deprecated
  completeness VARCHAR(20) NOT NULL DEFAULT 'partial',  -- partial / complete
  
  -- 元数据
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- 版本控制
  version INTEGER NOT NULL DEFAULT 1,
  notes TEXT   -- 补充说明
);

-- 索引
CREATE INDEX IF NOT EXISTS idx_defect_guidelines_claim_reason ON defect_guidelines(claim_reason);
CREATE INDEX IF NOT EXISTS idx_defect_guidelines_status ON defect_guidelines(status);
CREATE INDEX IF NOT EXISTS idx_defect_guidelines_risk_level ON defect_guidelines(risk_level);

-- 触发器：自动更新 updated_at
DROP TRIGGER IF EXISTS update_defect_guidelines_updated_at ON defect_guidelines;
CREATE TRIGGER update_defect_guidelines_updated_at
  BEFORE UPDATE ON defect_guidelines
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================================
-- 示例数据（可选 - 用于测试）
-- ============================================================

-- INSERT INTO defect_guidelines (claim_reason, materials, root_causes, prevention_measures, risk_level, status, completeness, notes) VALUES
-- ('抽丝/Frayed Yarn', '["Polyamide", "Nylon", "Polyester"]', 
--  '["织造张力不均匀", "后整理过程摩擦过大", "纱线质量不稳定"]',
--  '["定期校准织机张力设置", "使用表面光滑的导布辊", "增加纱线张力检测频率"]',
--  'high', 'published', 'partial',
--  '基于案例库自动生成，预防措施待补充完整数据');

-- INSERT INTO defect_guidelines (claim_reason, materials, root_causes, prevention_measures, risk_level, status, completeness, notes) VALUES
-- ('波浪形/Wavy', '["Polyamide", "Spandex混纺"]',
--  '["缝制时拉伸不均", "面料回缩不一致", "熨烫温度不当"]',
--  '["优化缝制工艺参数", "控制后整理温度", "增加成品尺寸稳定性测试"]',
--  'medium', 'published', 'partial',
--  '基于案例库自动生成，预防措施待补充完整数据');

-- ============================================================
-- RLS 策略（如果使用 Row Level Security）
-- ============================================================

-- ALTER TABLE defect_guidelines ENABLE ROW LEVEL SECURITY;
-- 
-- CREATE POLICY "Allow authenticated read" ON defect_guidelines
--   FOR SELECT TO authenticated USING (true);
-- 
-- CREATE POLICY "Allow service role all" ON defect_guidelines
--   FOR ALL TO service_role USING (true) WITH CHECK (true);