import { NextRequest, NextResponse } from "next/server";
import {
  classifyKnowledge,
  getClassifications,
  searchByClassification,
  searchImagesBySemanticQuery,
} from "@/lib/agents/pipelines";
import { getSupabaseClient } from "@/storage/database/supabase-client";

/**
 * GET /api/classifications
 * Query parameters:
 * - type: Filter by category_type (claim_reason, material, position)
 * - search: Search by category name or standard terms
 * - semantic: Semantic query for image search (e.g., "给我几张抽丝的照片")
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const type = searchParams.get("type");
    const search = searchParams.get("search");
    const semantic = searchParams.get("semantic");
    const limit = parseInt(searchParams.get("limit") || "10");

    // Semantic image search
    if (semantic) {
      const results = await searchImagesBySemanticQuery(semantic, limit, request.headers);
      return NextResponse.json({
        success: true,
        type: "semantic_search",
        query: semantic,
        ...results,
      });
    }

    // Classification-based search
    if (search && type) {
      const results = await searchByClassification(type, search, limit);
      return NextResponse.json({
        success: true,
        type: "classification_search",
        categoryType: type,
        searchTerm: search,
        results,
        count: results.length,
      });
    }

    // Get all classifications (optionally filtered by type)
    const classifications = await getClassifications(type || undefined);

    return NextResponse.json({
      success: true,
      type: "list",
      classifications,
      count: classifications.length,
      filters: type ? { category_type: type } : null,
    });
  } catch (error: any) {
    console.error("Classifications API error:", error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}

/**
 * POST /api/classifications
 * Trigger knowledge classification (reclassify all cases)
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    
    // Check if this is a forced reclassification
    const force = body.force === true;

    const client = getSupabaseClient();

    // Check if we already have recent classifications (unless forced)
    if (!force) {
      const { data: recentVersion, error } = await client
        .from("classification_versions")
        .select("*")
        .eq("status", "active")
        .order("generated_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (recentVersion && !error) {
        const lastClassified = new Date(recentVersion.generated_at);
        const hoursSinceLast = (Date.now() - lastClassified.getTime()) / (1000 * 60 * 60);

        // If classified within last hour, return existing
        if (hoursSinceLast < 1) {
          return NextResponse.json({
            success: true,
            message: "Using recent classification",
            version: recentVersion.version,
            generated_at: recentVersion.generated_at,
            summary: recentVersion.summary,
            force_reclassify: true,
          });
        }
      }
    }

    // Run classification
    const result = await classifyKnowledge(request.headers);

    if (!result) {
      return NextResponse.json(
        { 
          success: false, 
          error: "Classification failed. Make sure there are defect cases in the database." 
        },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      message: "Knowledge classification completed",
      result: {
        version: result.classification_version,
        claim_categories_count: result.claim_categories?.length || 0,
        material_categories_count: result.material_categories?.length || 0,
        position_categories_count: result.position_categories?.length || 0,
        summary: result.summary,
      },
    });
  } catch (error: any) {
    console.error("Classification API error:", error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
