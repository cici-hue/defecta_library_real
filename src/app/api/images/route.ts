import { NextResponse } from "next/server";
import { getSupabaseClient } from "@/storage/database/supabase-client";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get("limit") || "50");
    const offset = parseInt(searchParams.get("offset") || "0");
    const documentId = searchParams.get("document_id");
    const search = searchParams.get("search");
    const claimReason = searchParams.get("claim_reason");
    const materials = searchParams.get("materials");

    const client = getSupabaseClient();

    let query = client
      .from("document_images")
      .select(`
        id,
        filename,
        mime_type,
        file_size,
        source_slide,
        slide_text,
        materials,
        claim_reason,
        style,
        position,
        defect_description,
        created_at,
        document:documents!inner(
          id,
          filename
        )
      `, { count: "exact" })
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1);

    if (documentId) {
      query = query.eq("document_id", documentId);
    }

    if (search) {
      query = query.or(`filename.ilike.%${search}%,slide_text.ilike.%${search}%`);
    }

    if (claimReason) {
      query = query.eq("claim_reason", claimReason);
    }

    if (materials) {
      query = query.eq("materials", materials);
    }

    const { data: images, error, count } = await query;

    if (error) throw new Error(`查询图片失败: ${error.message}`);

    const formattedImages = (images || []).map((img: any) => ({
      id: img.id,
      filename: img.filename,
      mime_type: img.mime_type,
      file_size: img.file_size,
      source_slide: img.source_slide,
      slide_text: img.slide_text,
      materials: img.materials,
      claim_reason: img.claim_reason,
      style: img.style,
      position: img.position,
      defect_description: img.defect_description,
      created_at: img.created_at,
      document_id: img.document?.id,
      document_filename: img.document?.filename,
      image_url: `/api/images/${img.id}`,
    }));

    return NextResponse.json({
      images: formattedImages,
      total: count || formattedImages.length,
      offset,
      limit,
    });
  } catch (error) {
    console.error("Get images error:", error);
    const message = error instanceof Error ? error.message : "获取图片列表失败";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
