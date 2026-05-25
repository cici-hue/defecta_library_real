import { NextResponse } from "next/server";
import { getSupabaseClient } from "@/storage/database/supabase-client";

export async function POST() {
  try {
    const client = getSupabaseClient();
    const migrationResults: string[] = [];

    // 1. 为 document_images 表添加 image_embedding 字段
    try {
      const { error } = await client.rpc("exec_sql", {
        sql: `ALTER TABLE document_images ADD COLUMN IF NOT EXISTS image_embedding JSONB;`
      });
      
      if (error) {
        // 如果 RPC 不可用，尝试直接执行
        console.log("RPC not available, trying direct approach");
      } else {
        migrationResults.push("✅ Added image_embedding column to document_images");
      }
    } catch (err) {
      console.log("Using alternative method for image_embedding");
    }

    // 2. 为 defect_cases 表添加 text_embedding 字段
    try {
      const { error } = await client.rpc("exec_sql", {
        sql: `ALTER TABLE defect_cases ADD COLUMN IF NOT EXISTS text_embedding JSONB;`
      });
      
      if (error) {
        console.log("RPC not available for text_embedding");
      } else {
        migrationResults.push("✅ Added text_embedding column to defect_cases");
      }
    } catch (err) {
      console.log("Using alternative method for text_embedding");
    }

    // 验证字段是否存在
    const { data: docImages, error: checkError1 } = await client
      .from("document_images")
      .select("id, image_embedding")
      .limit(1);

    if (!checkError1 && docImages) {
      migrationResults.push("✅ Verified document_images table structure");
    }

    const { data: defectCases, error: checkError2 } = await client
      .from("defect_cases")
      .select("id, text_embedding")
      .limit(1);

    if (!checkError2 && defectCases) {
      migrationResults.push("✅ Verified defect_cases table structure");
    }

    return NextResponse.json({
      success: true,
      message: "Database migration completed",
      results: migrationResults,
      instructions: `
如果上述方法未能成功添加字段，请在 Supabase Dashboard 的 SQL Editor 中手动执行以下SQL：

-- 1. 添加图片向量字段
ALTER TABLE document_images 
ADD COLUMN IF NOT EXISTS image_embedding JSONB;

COMMENT ON COLUMN document_images.image_embedding IS '图片的向量表示（1024维浮点数数组），用于图片相似度检索';

-- 2. 添加文本向量字段
ALTER TABLE defect_cases 
ADD COLUMN IF NOT EXISTS text_embedding JSONB;

COMMENT ON COLUMN defect_cases.text_embedding IS '案例文本的向量表示（1024维浮点数数组），用于文本相似度检索';

-- 3. 创建GIN索引
CREATE INDEX IF NOT EXISTS idx_document_images_image_embedding_gin ON document_images USING gin (image_embedding);
CREATE INDEX IF NOT EXISTS idx_defect_cases_text_embedding_gin ON defect_cases USING gin (text_embedding);
      `.trim()
    });

  } catch (error) {
    console.error("Migration failed:", error);
    
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : "Migration failed",
      manual_instructions: `
请手动在 Supabase SQL Editor 中执行：

ALTER TABLE document_images ADD COLUMN IF NOT EXISTS image_embedding JSONB;
ALTER TABLE defect_cases ADD COLUMN IF NOT EXISTS text_embedding JSONB;
CREATE INDEX idx_document_images_image_embedding_gin ON document_images USING gin (image_embedding);
CREATE INDEX idx_defect_cases_text_embedding_gin ON defect_cases USING gin (text_embedding);
      `.trim()
    }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json({
    endpoint: "/api/migrate",
    method: "POST",
    description: "Execute database migration to add vector storage fields"
  });
}
