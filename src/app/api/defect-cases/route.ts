import { NextResponse, NextRequest } from "next/server";
import { getSupabaseClient } from "@/storage/database/supabase-client";

export async function GET(request: NextRequest) {
  try {
    const client = getSupabaseClient();
    const { searchParams } = new URL(request.url);
    
    const documentId = searchParams.get("document_id");
    const limit = parseInt(searchParams.get("limit") || "50");
    const offset = parseInt(searchParams.get("offset") || "0");

    // Build query
    let query = client
      .from("defect_cases")
      .select(`
        *,
        document_images (
          id,
          filename,
          file_key,
          mime_type,
          file_size
        ),
        documents (
          id,
          filename
        )
      `)
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1);

    if (documentId) {
      query = query.eq("document_id", documentId);
    }

    const { data, error, count } = await query;

    if (error) throw new Error(`Query failed: ${error.message}`);

    // Transform data to add image_url
    const casesWithUrls = (data || []).map((item: any) => ({
      ...item,
      image_url: item.document_images?.file_key 
        ? `/api/images/file?file_key=${encodeURIComponent(item.document_images.file_key)}`
        : null,
    }));

    return NextResponse.json({
      defect_cases: casesWithUrls,
      total: count || casesWithUrls.length,
      offset,
      limit,
    });
  } catch (error) {
    console.error("Get defect cases error:", error);
    const message = error instanceof Error ? error.message : "获取失败";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
