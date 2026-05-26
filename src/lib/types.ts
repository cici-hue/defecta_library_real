// ============================================================
// Defect Case Types
// ============================================================

export interface DefectCase {
  id: string;
  document_id: string;
  image_id?: string | null;
  source_slide?: number | null;
  
  // 案例基本信息
  materials?: string | null;
  style?: string | null;
  claim_reason: string;
  defect_description?: string | null;
  position?: string | null;
  
  // RCA 报告（预留字段）
  rca_root_cause?: string | null;
  rca_prevention?: string | null;
  rca_correction?: string | null;
  
  // Embedding
  embedding?: any[] | null;
  
  // 元数据
  created_at: string;
  updated_at?: string | null;
}

export interface DefectCaseWithImage extends DefectCase {
  image_filename?: string | null;
  image_file_key?: string | null;
  image_mime_type?: string | null;
  image_file_size?: number | null;
  document_filename?: string | null;
  image_url?: string;
}

export interface ExtractedDefectCase {
  image_filename: string;
  materials?: string;
  style?: string;
  claim_reason: string;
  defect_description?: string;
  position?: string;
}

export interface DocumentExtractionResult {
  defect_cases: ExtractedDefectCase[];
  raw_text: string;
}
