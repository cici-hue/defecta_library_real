import { NextRequest, NextResponse } from "next/server";
import { S3Storage } from "coze-coding-dev-sdk";
import { getSupabaseClient } from "@/storage/database/supabase-client";
import { uploadFileLocal } from "@/lib/local-storage";

// 检查是否使用本地存储
const useLocalStorage = !process.env.COZE_BUCKET_ENDPOINT_URL;

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json({ error: "请选择文件" }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    let fileKey: string;

    if (useLocalStorage) {
      // 使用本地文件存储
      fileKey = await uploadFileLocal({
        fileContent: buffer,
        fileName: file.name,
        contentType: file.type || "application/octet-stream",
      });
    } else {
      // 使用 S3 存储
      const storage = new S3Storage({
        endpointUrl: process.env.COZE_BUCKET_ENDPOINT_URL,
        accessKey: "",
        secretKey: "",
        bucketName: process.env.COZE_BUCKET_NAME,
        region: "cn-beijing",
      });

      fileKey = await storage.uploadFile({
        fileContent: buffer,
        fileName: `documents/${file.name}`,
        contentType: file.type || "application/octet-stream",
      });
    }

    // Save document record to database
    const client = getSupabaseClient();
    const { data, error } = await client
      .from("documents")
      .insert({
        filename: file.name,
        file_key: fileKey,
        file_type: file.name.split(".").pop() || "unknown",
        file_size: file.size,
        status: "pending",
      })
      .select("id, filename, file_type, file_size, status, created_at")
      .single();

    if (error) throw new Error(`保存文档记录失败: ${error.message}`);

    return NextResponse.json({ document: data });
  } catch (error) {
    const message = error instanceof Error ? error.message : "上传失败";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function GET() {
  try {
    const client = getSupabaseClient();
    const { data, error } = await client
      .from("documents")
      .select("id, filename, file_type, file_size, status, created_at")
      .order("created_at", { ascending: false });

    if (error) throw new Error(`查询文档失败: ${error.message}`);

    return NextResponse.json({ documents: data || [] });
  } catch (error) {
    const message = error instanceof Error ? error.message : "查询失败";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
