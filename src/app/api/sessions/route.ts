import { NextRequest, NextResponse } from "next/server";
import { getSupabaseClient } from "@/storage/database/supabase-client";

export async function GET(request: NextRequest) {
  try {
    const client = getSupabaseClient();
    const { searchParams } = new URL(request.url);
    const sessionId = searchParams.get("session_id");

    if (sessionId) {
      // Get messages for a specific session
      const { data: messages, error } = await client
        .from("chat_messages")
        .select("id, role, content, sources, created_at")
        .eq("session_id", sessionId)
        .order("created_at", { ascending: true });

      if (error) throw new Error(`查询消息失败: ${error.message}`);
      return NextResponse.json({ messages: messages || [] });
    }

    // Get all sessions
    const { data: sessions, error } = await client
      .from("chat_sessions")
      .select("id, title, created_at, updated_at")
      .order("updated_at", { ascending: false })
      .limit(50);

    if (error) throw new Error(`查询会话失败: ${error.message}`);
    return NextResponse.json({ sessions: sessions || [] });
  } catch (error) {
    const message = error instanceof Error ? error.message : "查询失败";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const client = getSupabaseClient();
    const { searchParams } = new URL(request.url);
    const sessionId = searchParams.get("session_id");

    if (!sessionId) {
      return NextResponse.json({ error: "缺少session_id参数" }, { status: 400 });
    }

    // Delete messages first (cascade should handle this, but be explicit)
    await client.from("chat_messages").delete().eq("session_id", sessionId);
    await client.from("chat_sessions").delete().eq("id", sessionId);

    return NextResponse.json({ message: "删除成功" });
  } catch (error) {
    const message = error instanceof Error ? error.message : "删除失败";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
