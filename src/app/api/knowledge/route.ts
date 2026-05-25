import { NextRequest, NextResponse } from "next/server";
import { getSupabaseClient } from "@/storage/database/supabase-client";

export async function GET(request: NextRequest) {
  try {
    const client = getSupabaseClient();
    const { searchParams } = new URL(request.url);
    const type = searchParams.get("type");
    const search = searchParams.get("search") || "";
    const limit = parseInt(searchParams.get("limit") || "20");
    const offset = parseInt(searchParams.get("offset") || "0");

    // Get active schema
    const { data: activeSchema } = await client
      .from("knowledge_schemas")
      .select("id, schema_description, schema_structure, version, created_at")
      .eq("is_active", "true")
      .order("version", { ascending: false })
      .limit(1)
      .maybeSingle();

    // If type=schema, only return schema info
    if (type === "schema") {
      return NextResponse.json({
        schema: activeSchema || null,
      });
    }

    if (!activeSchema) {
      return NextResponse.json({
        schema: null,
        chunks: [],
        total: 0,
      });
    }

    // Query chunks
    let query = client
      .from("knowledge_chunks")
      .select("id, chunk_text, metadata, source_document_ids, related_chunk_ids, created_at", { count: "exact" })
      .eq("knowledge_schema_id", activeSchema.id)
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1);

    // If search keyword provided, filter by text content
    if (search) {
      query = query.ilike("chunk_text", `%${search}%`);
    }

    const { data: chunks, error: chunksError, count } = await query;

    if (chunksError) throw new Error(`查询知识块失败: ${chunksError.message}`);

    return NextResponse.json({
      schema: activeSchema,
      chunks: chunks || [],
      total: count || 0,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "查询失败";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
