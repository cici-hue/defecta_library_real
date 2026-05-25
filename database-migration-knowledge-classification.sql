-- Knowledge Classification Tables Migration
-- Adds support for intelligent knowledge categorization and semantic understanding

-- ============================================================
-- Table: knowledge_classifications
-- Stores the hierarchical classification system for defect cases
-- ============================================================

CREATE TABLE IF NOT EXISTS knowledge_classifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Classification metadata
  category_type VARCHAR(50) NOT NULL,  -- 'claim_reason' | 'material' | 'position' | 'defect_type'
  category_name VARCHAR(200) NOT NULL,  -- Display name: '抽丝/Frayed Yarn'
  parent_category_id UUID REFERENCES knowledge_classifications(id),
  
  -- Standardization
  standard_terms TEXT[],  -- Standard terminology: ['抽丝', 'Frayed Yarn', '线头']
  aliases TEXT[],  -- Synonyms/aliases
  
  -- Description
  description TEXT,
  
  -- Statistics (computed during classification)
  case_count INTEGER DEFAULT 0,
  image_count INTEGER DEFAULT 0,
  risk_level VARCHAR(20),  -- 'high' | 'medium' | 'low' | null
  
  -- Rich content (JSONB for flexibility)
  sub_categories JSONB DEFAULT '[]',  -- Array of sub-category summaries
  statistics JSONB DEFAULT '{}',  -- Detailed stats: {by_material: {}, by_position: {}}
  common_causes JSONB DEFAULT '[]',  -- Array of cause strings
  prevention_tips JSONB DEFAULT '[]',  -- Array of tip strings
  related_materials TEXT[],
  related_positions TEXT[],
  characteristics JSONB DEFAULT '[]',  -- Material characteristics
  
  -- Cross-analysis data
  cross_analysis JSONB DEFAULT '{}',
  
  -- Versioning
  version VARCHAR(20) DEFAULT 'v1',
  is_active BOOLEAN DEFAULT true,
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for knowledge_classifications
CREATE INDEX IF NOT EXISTS idx_kc_type ON knowledge_classifications(category_type);
CREATE INDEX IF NOT EXISTS idx_kc_parent ON knowledge_classifications(parent_category_id);
CREATE INDEX IF NOT EXISTS idx_kc_active ON knowledge_classifications(is_active);
CREATE INDEX IF NOT EXISTS idx_kc_risk ON knowledge_classifications(risk_level);
CREATE INDEX IF NOT EXISTS idx_kc_name_search ON knowledge_classifications USING gin(to_tsvector('simple', category_name));
CREATE INDEX IF NOT EXISTS idx_kc_terms ON knowledge_classifications USING gin(standard_terms);

-- ============================================================
-- Table: case_classification_mapping
-- Maps defect cases to their classifications (many-to-many)
-- ============================================================

CREATE TABLE IF NOT EXISTS case_classification_mapping (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Foreign keys
  case_id UUID NOT NULL REFERENCES defect_cases(id) ON DELETE CASCADE,
  classification_id UUID NOT NULL REFERENCES knowledge_classifications(id) ON DELETE CASCADE,
  
  -- Mapping quality
  relevance_score FLOAT CHECK (relevance_score >= 0 AND relevance_score <= 1),  -- 0-1 relevance
  is_primary BOOLEAN DEFAULT false,  -- Is this the primary classification for this case?
  assigned_by VARCHAR(50) DEFAULT 'auto',  -- 'auto' | 'manual' | 'ai_reviewed'
  
  -- Context
  match_reason TEXT,  -- Why this case belongs to this category
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Unique constraint to prevent duplicate mappings
CREATE UNIQUE INDEX IF NOT EXISTS idx_ccm_unique ON case_classification_mapping(case_id, classification_id);

-- Indexes for efficient queries
CREATE INDEX IF NOT EXISTS idx_ccm_case ON case_classification_mapping(case_id);
CREATE INDEX IF NOT EXISTS idx_ccm_classification ON case_classification_mapping(classification_id);
CREATE INDEX IF NOT EXISTS idx_ccm_primary ON case_classification_mapping(is_primary);
CREATE INDEX IF NOT EXISTS idx_ccm_relevance ON case_classification_mapping(relevance_score DESC);

-- ============================================================
-- Table: classification_versions
-- Tracks version history of classifications (for auditing)
-- ============================================================

CREATE TABLE IF NOT EXISTS classification_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  version VARCHAR(20) NOT NULL,
  generated_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Version summary
  total_classifications INTEGER DEFAULT 0,
  total_cases_analyzed INTEGER DEFAULT 0,
  total_mappings INTEGER DEFAULT 0,
  
  -- Summary JSON (from classifier output)
  summary JSONB DEFAULT '{}',
  
  -- Full classification data (complete snapshot)
  classification_data JSONB DEFAULT '{}',
  
  -- Metadata
  triggered_by VARCHAR(50) DEFAULT 'pipeline',  -- 'pipeline' | 'manual' | 'scheduled'
  document_ids UUID[],  -- Which documents triggered this classification
  notes TEXT,
  
  -- Status
  status VARCHAR(20) DEFAULT 'active',  -- 'active' | 'superseded' | 'archived'
  
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_cv_version ON classification_versions(version);
CREATE INDEX IF NOT EXISTS idx_cv_status ON classification_versions(status);
CREATE INDEX IF NOT EXISTS idx_cv_created ON classification_versions(generated_at DESC);

-- ============================================================
-- Function: Update updated_at timestamp
-- ============================================================

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Triggers for automatic timestamp updates
DROP TRIGGER IF EXISTS update_knowledge_classifications_updated_at ON knowledge_classifications;
CREATE TRIGGER update_knowledge_classifications_updated_at
    BEFORE UPDATE ON knowledge_classifications
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- ============================================================
-- RLS Policies (if using Supabase with RLS enabled)
-- ============================================================

ALTER TABLE knowledge_classifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE case_classification_mapping ENABLE ROW LEVEL SECURITY;
ALTER TABLE classification_versions ENABLE ROW LEVEL SECURITY;

-- Policy: Allow all reads (public knowledge base)
CREATE POLICY "Classifications are publicly readable" ON knowledge_classifications
  FOR SELECT USING (true);

CREATE POLICY "Mappings are publicly readable" ON case_classification_mapping
  FOR SELECT USING (true);

CREATE POLICY "Versions are publicly readable" ON classification_versions
  FOR SELECT USING (true);

-- Policy: Allow service role to manage classifications
CREATE POLICY "Service role can manage classifications" ON knowledge_classifications
  FOR ALL USING (true)
  WITH CHECK (true);

CREATE POLICY "Service role can manage mappings" ON case_classification_mapping
  FOR ALL USING (true)
  WITH CHECK (true);

CREATE POLICY "Service role can manage versions" ON classification_versions
  FOR ALL USING (true)
  WITH CHECK (true);

-- ============================================================
-- Comments for documentation
-- ============================================================

COMMENT ON TABLE knowledge_classifications IS 
  'Hierarchical classification system for defect cases. Supports multi-dimensional categorization by claim reason, material, position, etc.';

COMMENT ON TABLE case_classification_mapping IS 
  'Many-to-many mapping between defect cases and their classifications. Includes relevance scores and primary classification flags.';

COMMENT ON TABLE classification_versions IS 
  'Version history of knowledge classifications. Used for tracking changes and rollback capability.';

COMMENT ON COLUMN knowledge_classifications.category_type IS 
  'Type of classification: claim_reason (defect type), material, position, or general defect_type';

COMMENT ON COLUMN knowledge_classifications.standard_terms IS 
  'Array of standardized terms for this category. Used for semantic matching and search normalization.';

COMMENT ON COLUMN case_classification_mapping.relevance_score IS 
  'How relevant this case is to this classification (0.0 to 1.0). Higher = more relevant.';

COMMENT ON COLUMN case_classification_mapping.is_primary IS 
  'If true, this is the main/most accurate classification for this case. A case can have multiple classifications but only one primary.';

-- ============================================================
-- Done!
-- ============================================================