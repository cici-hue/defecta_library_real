import { NextResponse } from "next/server";
import { getSupabaseClient } from "@/storage/database/supabase-client";

export async function GET() {
  try {
    const client = getSupabaseClient();

    // Document stats
    const { count: totalDocs } = await client
      .from("documents")
      .select("*", { count: "exact", head: true });

    const { count: completedDocs } = await client
      .from("documents")
      .select("*", { count: "exact", head: true })
      .eq("status", "completed");

    const { count: processingDocs } = await client
      .from("documents")
      .select("*", { count: "exact", head: true })
      .eq("status", "processing");

    // Knowledge stats
    const { count: totalChunks } = await client
      .from("knowledge_chunks")
      .select("*", { count: "exact", head: true });

    // Active schema info
    const { data: activeSchema } = await client
      .from("knowledge_schemas")
      .select("id, version, schema_description, created_at")
      .eq("is_active", "true")
      .order("version", { ascending: false })
      .limit(1)
      .maybeSingle();

    // Chat stats
    const { count: totalSessions } = await client
      .from("chat_sessions")
      .select("*", { count: "exact", head: true });

    return NextResponse.json({
      documents: {
        total: totalDocs || 0,
        completed: completedDocs || 0,
        processing: processingDocs || 0,
      },
      knowledge: {
        total_chunks: totalChunks || 0,
        schema_version: activeSchema?.version || 0,
        schema_description: activeSchema?.schema_description || "暂无",
        last_updated: activeSchema?.created_at || null,
      },
      chat: {
        total_sessions: totalSessions || 0,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "查询失败";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
