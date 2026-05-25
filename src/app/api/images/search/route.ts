import { NextRequest, NextResponse } from "next/server";
import { searchSimilarImages } from "@/lib/agents/pipelines";

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const imageFile = formData.get("image") as File | null;

    if (!imageFile) {
      return NextResponse.json({ error: "请上传图片" }, { status: 400 });
    }

    const buffer = Buffer.from(await imageFile.arrayBuffer());

    const similarImages = await searchSimilarImages(buffer, 10);

    const results = similarImages.map((img) => ({
      id: img.id,
      filename: img.filename,
      image_url: `/api/images/${img.id}`,
      source_document_ids: img.source_document_ids,
      source_slide: img.source_slide,
      similarity: img.similarity,
    }));

    return NextResponse.json({
      total: results.length,
      results,
    });
  } catch (error) {
    console.error("Image search error:", error);
    const message = error instanceof Error ? error.message : "图片搜索失败";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
