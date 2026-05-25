import { NextResponse } from "next/server";
import { getSupabaseClient } from "@/storage/database/supabase-client";

export async function GET() {
  try {
    const client = getSupabaseClient();
    const results: any = {};

    // 1. 检查文档数量
    const { data: documents, error: docError } = await client
      .from("documents")
      .select("id, filename, status")
      .order("created_at", { ascending: false })
      .limit(5);
    
    if (docError) throw docError;
    results.documents = documents;

    // 2. 检查图片数量
    const { data: images, error: imgError } = await client
      .from("document_images")
      .select("id, filename, document_id, materials, claim_reason")
      .order("created_at", { ascending: false })
      .limit(10);
    
    if (imgError) throw imgError;
    results.document_images_count = images?.length || 0;
    results.document_images_sample = images?.slice(0, 3);

    // 3. 检查缺陷案例数量（关键！）
    const { data: cases, error: caseError } = await client
      .from("defect_cases")
      .select(`
        id,
        document_id,
        claim_reason,
        materials,
        position,
        created_at,
        document_images (
          id, filename
        )
      `)
      .order("created_at", { ascending: false })
      .limit(10);
    
    if (caseError) throw caseError;
    results.defect_cases_count = cases?.length || 0;
    results.defect_cases_sample = cases?.slice(0, 5);

    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      ...results,
    });

  } catch (error) {
    console.error("Debug query failed:", error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : "Query failed",
    }, { status: 500 });
  }
}
