import { NextRequest, NextResponse } from "next/server";
import { getSupabaseClient } from "@/storage/database/supabase-client";
import { deleteFileLocal } from "@/lib/local-storage";

// 检查是否使用本地存储
const useLocalStorage = !process.env.COZE_BUCKET_ENDPOINT_URL;

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const client = getSupabaseClient();

    // 先获取文档信息，以便删除文件
    const { data: doc, error: fetchError } = await client
      .from("documents")
      .select("file_key")
      .eq("id", id)
      .maybeSingle();

    if (fetchError) throw new Error(`获取文档信息失败: ${fetchError.message}`);

    // 如果是本地存储，删除文件
    if (useLocalStorage && doc?.file_key) {
      try {
        await deleteFileLocal(doc.file_key);
      } catch (err) {
        console.error("删除本地文件失败:", err);
        // 继续删除数据库记录，即使文件删除失败
      }
    }

    const { error } = await client.from("documents").delete().eq("id", id);
    if (error) throw new Error(`删除文档失败: ${error.message}`);

    return NextResponse.json({ message: "删除成功" });
  } catch (error) {
    const message = error instanceof Error ? error.message : "删除失败";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
