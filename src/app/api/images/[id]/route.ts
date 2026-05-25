import { NextRequest, NextResponse } from "next/server";
import { getSupabaseClient } from "@/storage/database/supabase-client";
import { readFileLocal } from "@/lib/local-storage";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const client = getSupabaseClient();

    const { data: image, error } = await client
      .from("document_images")
      .select("file_key, mime_type, filename")
      .eq("id", id)
      .maybeSingle();

    if (error) throw new Error(`查询图片失败: ${error.message}`);
    if (!image) {
      return NextResponse.json({ error: "图片不存在" }, { status: 404 });
    }

    const imageBuffer = await readFileLocal(image.file_key);

    return new NextResponse(new Uint8Array(imageBuffer), {
      headers: {
        "Content-Type": image.mime_type || "application/octet-stream",
        "Content-Disposition": `inline; filename="${image.filename}"`,
        "Cache-Control": "public, max-age=31536000",
      },
    });
  } catch (error) {
    console.error("Image retrieval error:", error);
    const message = error instanceof Error ? error.message : "获取图片失败";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
