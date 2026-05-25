import { NextRequest } from "next/server";
import { getSupabaseClient } from "@/storage/database/supabase-client";
import { chatPipeline, defectCaseRetrievalPipeline } from "@/lib/agents/pipelines";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { question, session_id, image_data, image_mime_type } = body;

    if (!question && !image_data) {
      return new Response(JSON.stringify({ error: "请输入问题或上传图片" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    let sessionId = session_id;
    const client = getSupabaseClient();

    // Create session if not provided
    if (!sessionId) {
      const title = (question || "图片查询").slice(0, 50);
      const { data, error } = await client
        .from("chat_sessions")
        .insert({ title })
        .select("id")
        .single();

      if (error) throw new Error(`创建会话失败: ${error.message}`);
      sessionId = data.id;
    } else {
      // Update session title if first message
      const { data: messages } = await client
        .from("chat_messages")
        .select("id")
        .eq("session_id", sessionId)
        .limit(1);

      if (!messages || messages.length === 0) {
        await client
          .from("chat_sessions")
          .update({ title: (question || "图片查询").slice(0, 50) })
          .eq("id", sessionId);
      }
    }

    // Convert base64 image data to Buffer if present
    let imageBuffer: Buffer | null = null;
    if (image_data) {
      try {
        imageBuffer = Buffer.from(image_data, "base64");
      } catch (err) {
        console.error("Failed to decode image data:", err);
      }
    }

    // Stream the response
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        // Send session_id first
        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify({ type: "session", session_id: sessionId })}\n\n`)
        );

        try {
          // Use the appropriate pipeline based on whether image is provided
          if (imageBuffer) {
            // Use the new defect case retrieval pipeline with image support
            for await (const chunk of defectCaseRetrievalPipeline(
              question || "请分析这张图片中的缺陷案例",
              sessionId,
              request.headers,
              imageBuffer,
              image_mime_type
            )) {
              controller.enqueue(
                encoder.encode(`data: ${JSON.stringify({ type: "content", content: chunk })}\n\n`)
              );
            }
          } else {
            // Use the original text-based chat pipeline
            for await (const chunk of chatPipeline(question, sessionId, request.headers)) {
              controller.enqueue(
                encoder.encode(`data: ${JSON.stringify({ type: "content", content: chunk })}\n\n`)
              );
            }
          }

          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify({ type: "done" })}\n\n`)
          );
        } catch (err) {
          const errorMsg = err instanceof Error ? err.message : "生成回答失败";
          console.error("Chat pipeline error:", err);
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify({ type: "error", error: errorMsg })}\n\n`)
          );
        } finally {
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      },
    });
  } catch (error) {
    console.error("Chat API error:", error);
    const message = error instanceof Error ? error.message : "请求失败";
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}
