import { NextRequest, NextResponse } from "next/server";
import { readFileLocal } from "@/lib/local-storage";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const fileKey = searchParams.get("file_key");

    if (!fileKey) {
      return NextResponse.json({ error: "缺少 file_key 参数" }, { status: 400 });
    }

    const imageBuffer = await readFileLocal(fileKey);

    // 从 fileKey 中提取文件名和扩展名
    const fileName = fileKey.split("/").pop() || "image";
    const ext = fileName.split(".").pop()?.toLowerCase() || "png";
    
    // 简单的 MIME 类型映射
    const mimeTypes: Record<string, string> = {
      png: "image/png",
      jpg: "image/jpeg",
      jpeg: "image/jpeg",
      gif: "image/gif",
      bmp: "image/bmp",
      webp: "image/webp",
      svg: "image/svg+xml",
      emf: "image/x-emf",
    };
    const mimeType = mimeTypes[ext] || "application/octet-stream";

    return new NextResponse(new Uint8Array(imageBuffer), {
      headers: {
        "Content-Type": mimeType,
        "Content-Disposition": `inline; filename="${fileName}"`,
        "Cache-Control": "public, max-age=31536000",
      },
    });
  } catch (error) {
    console.error("Image file retrieval error:", error);
    const message = error instanceof Error ? error.message : "获取图片失败";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
