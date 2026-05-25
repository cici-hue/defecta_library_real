"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import {
  BookOpen,
  Search,
  Loader2,
  ChevronRight,
  FileText,
  Image as ImageIcon,
  X,
  ChevronDown,
} from "lucide-react";

interface DefectCase {
  id: string;
  document_id: string;
  image_id: string | null;
  source_slide: number | null;
  materials: string | null;
  style: string | null;
  claim_reason: string;
  defect_description: string | null;
  position: string | null;
  rca_root_cause: string | null;
  rca_prevention: string | null;
  rca_correction: string | null;
  created_at: string;
  updated_at: string;
  // 关联数据
  document_images?: {
    id: string;
    filename: string;
    file_key: string;
    mime_type: string;
    file_size: number;
  } | null;
  documents?: {
    id: string;
    filename: string;
  } | null;
  image_url: string | null;
}

interface DocumentOption {
  id: string;
  filename: string;
}

export default function KnowledgePage() {
  const [defectCases, setDefectCases] = useState<DefectCase[]>([]);
  const [documents, setDocuments] = useState<DocumentOption[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [selectedCase, setSelectedCase] = useState<DefectCase | null>(null);
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [showFilters, setShowFilters] = useState(false);
  
  // Filters
  const [selectedDocument, setSelectedDocument] = useState<string | null>(null);
  const [claimReasonFilter, setClaimReasonFilter] = useState<string | null>(null);
  const [materialsFilter, setMaterialsFilter] = useState<string | null>(null);
  
  // Filter options (extracted from data)
  const [documentOptions, setDocumentOptions] = useState<DocumentOption[]>([]);
  const [claimReasonOptions, setClaimReasonOptions] = useState<string[]>([]);
  const [materialsOptions, setMaterialsOptions] = useState<string[]>([]);
  
  const PAGE_SIZE = 24;

  const fetchDefectCases = useCallback(async (reset = false) => {
    setLoading(true);
    try {
      const currentPage = reset ? 0 : page;
      const params = new URLSearchParams({
        limit: PAGE_SIZE.toString(),
        offset: (currentPage * PAGE_SIZE).toString(),
      });
      if (selectedDocument) params.set("document_id", selectedDocument);

      const res = await fetch(`/api/defect-cases?${params}`);
      const data = await res.json();

      if (data.defect_cases) {
        if (reset) {
          setDefectCases(data.defect_cases);
          setPage(1);
        } else {
          setDefectCases((prev) => [...prev, ...data.defect_cases]);
          setPage((prev) => prev + 1);
        }
        setHasMore(data.defect_cases.length === PAGE_SIZE);
      } else {
        if (reset) setDefectCases([]);
        setHasMore(false);
      }
    } catch (err) {
      console.error("Failed to fetch defect cases:", err);
    } finally {
      setLoading(false);
    }
  }, [page, selectedDocument]);

  const fetchDocuments = useCallback(async () => {
    try {
      const res = await fetch("/api/documents");
      const data = await res.json();
      if (data.documents) {
        setDocuments(data.documents);
        setDocumentOptions(data.documents);
      }
    } catch (err) {
      console.error("Failed to fetch documents:", err);
    }
  }, []);

  useEffect(() => {
    fetchDefectCases(true);
    fetchDocuments();
  }, [fetchDefectCases, fetchDocuments]);

  const handleSearch = () => {
    setPage(0);
    fetchDefectCases(true);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") handleSearch();
  };

  const handleFilterChange = () => {
    setPage(0);
    fetchDefectCases(true);
  };

  const clearFilters = () => {
    setSelectedDocument(null);
    setClaimReasonFilter(null);
    setMaterialsFilter(null);
    setSearchQuery("");
    setPage(0);
    fetchDefectCases(true);
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const hasActiveFilters = selectedDocument || claimReasonFilter || materialsFilter || searchQuery;

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950">
      {/* Header */}
      <header className="border-b bg-white dark:bg-slate-900">
        <div className="mx-auto max-w-7xl px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-6">
            <Link href="/" className="flex items-center gap-2 text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white">
              <BookOpen className="h-6 w-6" />
              <span className="font-bold">Defect Library</span>
            </Link>
            <nav className="flex items-center gap-4">
              <Link href="/admin" className="text-sm text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-white">
                管理后台
              </Link>
              <Link href="/chat" className="text-sm text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-white">
                智能问答
              </Link>
              <span className="text-sm font-medium text-blue-600 dark:text-blue-400">知识浏览</span>
            </nav>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-6 py-8">
        {/* Tabs & Search & Filters */}
        <div className="mb-6">
          <div className="flex gap-3 items-center flex-wrap">
            <div className="flex gap-1 p-1 bg-slate-100 dark:bg-slate-800 rounded-lg">
              <button
                className="px-4 py-2 text-sm font-medium rounded-md bg-white dark:bg-slate-700 text-blue-600 dark:text-blue-400 shadow-sm"
              >
                <ImageIcon className="h-4 w-4 inline-block mr-1" />
                缺陷案例 ({defectCases.length})
              </button>
            </div>

            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="搜索图片..."
                className="w-full pl-10 pr-4 py-2.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <button
              onClick={handleSearch}
              className="px-4 py-2.5 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors"
            >
              搜索
            </button>
            <button
              onClick={() => setShowFilters(!showFilters)}
              className={`px-4 py-2.5 text-sm font-medium rounded-lg border transition-colors ${
                showFilters || hasActiveFilters
                  ? "border-blue-300 bg-blue-50 text-blue-700 dark:border-blue-700 dark:bg-blue-950 dark:text-blue-300"
                  : "border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800"
              }`}
            >
              筛选 {hasActiveFilters && `(${[selectedDocument, claimReasonFilter, materialsFilter, searchQuery].filter(Boolean).length})`}
            </button>
            {hasActiveFilters && (
              <button
                onClick={clearFilters}
                className="px-4 py-2.5 text-sm font-medium rounded-lg border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
              >
                清除筛选
              </button>
            )}
          </div>

          {/* Filter Panel */}
          {showFilters && (
            <div className="mt-4 p-4 bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* Document Filter */}
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                    文档
                  </label>
                  <div className="relative">
                    <select
                      value={selectedDocument || ""}
                      onChange={(e) => {
                        setSelectedDocument(e.target.value || null);
                        handleFilterChange();
                      }}
                      className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 appearance-none pr-8"
                    >
                      <option value="">全部文档</option>
                      {documentOptions.map((doc) => (
                        <option key={doc.id} value={doc.id}>
                          {doc.filename}
                        </option>
                      ))}
                    </select>
                    <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
                  </div>
                </div>

                {/* Claim Reason Filter */}
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                    索赔原因
                  </label>
                  <div className="relative">
                    <select
                      value={claimReasonFilter || ""}
                      onChange={(e) => {
                        setClaimReasonFilter(e.target.value || null);
                        handleFilterChange();
                      }}
                      className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 appearance-none pr-8"
                    >
                      <option value="">全部原因</option>
                      <option value="Frayed Yarn">Frayed Yarn</option>
                      <option value="Broken Stitch">Broken Stitch</option>
                      <option value="Pilling">Pilling</option>
                      <option value="Color Bleeding">Color Bleeding</option>
                      <option value="Seam Opening">Seam Opening</option>
                    </select>
                    <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
                  </div>
                </div>

                {/* Materials Filter */}
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                    材料/面料
                  </label>
                  <div className="relative">
                    <select
                      value={materialsFilter || ""}
                      onChange={(e) => {
                        setMaterialsFilter(e.target.value || null);
                        handleFilterChange();
                      }}
                      className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 appearance-none pr-8"
                    >
                      <option value="">全部材料</option>
                      <option value="Polyamide">Polyamide</option>
                      <option value="Polyester">Polyester</option>
                      <option value="Cotton">Cotton</option>
                      <option value="Elastane">Elastane</option>
                      <option value="Nylon">Nylon</option>
                    </select>
                    <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Content Grid */}
        <div className="flex gap-6">
          {/* Main Content */}
          <div className="flex-1 min-w-0">
            {loading && defectCases.length === 0 ? (
              <div className="flex items-center justify-center py-12 text-slate-400">
                <Loader2 className="h-5 w-5 animate-spin mr-2" />
                加载中...
              </div>
            ) : defectCases.length === 0 ? (
              <div className="text-center py-12 text-slate-400">
                <ImageIcon className="h-12 w-12 mx-auto mb-3 opacity-50" />
                <p>暂无缺陷案例</p>
                <p className="text-xs mt-1">请上传包含图片的文档并处理，AI会自动提取缺陷案例</p>
              </div>
            ) : (
              <>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {defectCases.map((defectCase) => (
                    <div
                      key={defectCase.id}
                      onClick={() => setSelectedCase(defectCase)}
                      className={`relative group cursor-pointer rounded-lg overflow-hidden border-2 transition-all bg-white dark:bg-slate-800 ${
                        selectedCase?.id === defectCase.id
                          ? "border-blue-400 dark:border-blue-500 ring-2 ring-blue-200 dark:ring-blue-800"
                          : "border-slate-200 dark:border-slate-700 hover:border-blue-300 dark:hover:border-blue-600"
                      }`}
                    >
                      {/* 图片 */}
                      {defectCase.image_url ? (
                        <img
                          src={defectCase.image_url}
                          alt={defectCase.claim_reason}
                          className="w-full h-40 object-cover"
                        />
                      ) : (
                        <div className="w-full h-40 bg-slate-100 dark:bg-slate-800 flex items-center justify-center">
                          <ImageIcon className="h-12 w-12 text-slate-300 dark:text-slate-600" />
                        </div>
                      )}
                      
                      <div className="p-3 border-t border-slate-100 dark:border-slate-700">
                        {/* 索赔原因 */}
                        <p className="text-sm font-medium text-red-600 dark:text-red-400 mb-2 line-clamp-2">
                          {defectCase.claim_reason}
                        </p>
                        {/* 材料 */}
                        {defectCase.materials && (
                          <p className="text-xs text-slate-600 dark:text-slate-400 mb-1">
                            <span className="text-slate-400 dark:text-slate-500">材料:</span> {defectCase.materials}
                          </p>
                        )}
                        {/* 款式 */}
                        {defectCase.style && (
                          <p className="text-xs text-slate-600 dark:text-slate-400 mb-1">
                            <span className="text-slate-400 dark:text-slate-500">款式:</span> {defectCase.style}
                          </p>
                        )}
                        {/* 来源文档和页码 */}
                        <div className="flex items-center justify-between mt-2 pt-2 border-t border-slate-100 dark:border-slate-700">
                          <p className="text-xs text-slate-400 dark:text-slate-500 truncate">
                            {defectCase.source_slide ? `第 ${defectCase.source_slide} 页` : defectCase.documents?.filename}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                {hasMore && (
                  <div className="mt-6 text-center">
                    <button
                      onClick={() => fetchDefectCases(false)}
                      disabled={loading}
                      className="text-sm text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1 mx-auto px-4 py-2"
                    >
                      {loading ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <ChevronRight className="h-4 w-4 rotate-90" />
                      )}
                      加载更多
                    </button>
                  </div>
                )}
              </>
            )}
          </div>

          {/* Detail Panel */}
          {selectedCase && (
            <div className="w-[400px] shrink-0">
              <div className="sticky top-8 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
                <div className="p-4 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between">
                  <h3 className="font-semibold text-slate-900 dark:text-white">
                    缺陷案例详情
                  </h3>
                  <button
                    onClick={() => setSelectedCase(null)}
                    className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>

                <div className="max-h-[calc(100vh-140px)] overflow-y-auto">
                  {/* 图片 */}
                  {selectedCase.image_url && (
                    <div className="p-4 border-b border-slate-200 dark:border-slate-700">
                      <img
                        src={selectedCase.image_url}
                        alt={selectedCase.claim_reason}
                        className="w-full rounded-lg border border-slate-200 dark:border-slate-700"
                      />
                    </div>
                  )}

                  <div className="p-4 space-y-4">
                    {/* 缺陷信息标题 */}
                    <div className="flex items-center gap-2 pb-2 border-b border-slate-100 dark:border-slate-700">
                      <ImageIcon className="h-4 w-4 text-slate-400" />
                      <h4 className="font-semibold text-slate-800 dark:text-slate-200">缺陷信息</h4>
                    </div>

                    {/* 索赔原因 */}
                    {selectedCase.claim_reason && (
                      <div>
                        <label className="text-xs font-medium text-red-600 dark:text-red-400 uppercase tracking-wider">
                          索赔原因
                        </label>
                        <p className="text-sm text-slate-800 dark:text-slate-200 mt-1">
                          {selectedCase.claim_reason}
                        </p>
                      </div>
                    )}

                    {/* 材料 */}
                    {selectedCase.materials && (
                      <div>
                        <label className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                          材料
                        </label>
                        <p className="text-sm text-slate-800 dark:text-slate-200 mt-1">
                          {selectedCase.materials}
                        </p>
                      </div>
                    )}

                    {/* 款式 */}
                    {selectedCase.style && (
                      <div>
                        <label className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                          款式
                        </label>
                        <p className="text-sm text-slate-800 dark:text-slate-200 mt-1">
                          {selectedCase.style}
                        </p>
                      </div>
                    )}

                    {/* 缺陷位置 */}
                    {selectedCase.position && (
                      <div>
                        <label className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                          缺陷位置
                        </label>
                        <p className="text-sm text-slate-800 dark:text-slate-200 mt-1">
                          {selectedCase.position}
                        </p>
                      </div>
                    )}

                    {/* 缺陷描述 */}
                    {selectedCase.defect_description && (
                      <div>
                        <label className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                          缺陷描述
                        </label>
                        <p className="text-sm text-slate-800 dark:text-slate-200 mt-1">
                          {selectedCase.defect_description}
                        </p>
                      </div>
                    )}

                    {/* RCA 信息（预留） */}
                    {(selectedCase.rca_root_cause || selectedCase.rca_prevention || selectedCase.rca_correction) && (
                      <>
                        <div className="pt-3 border-t border-slate-100 dark:border-slate-700">
                          <h5 className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-3">
                            RCA 分析（预留）
                          </h5>
                        </div>
                        
                        {selectedCase.rca_root_cause && (
                          <div>
                            <label className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                              根本原因
                            </label>
                            <p className="text-sm text-slate-800 dark:text-slate-200 mt-1">
                              {selectedCase.rca_root_cause}
                            </p>
                          </div>
                        )}
                        
                        {selectedCase.rca_prevention && (
                          <div>
                            <label className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                              预防措施
                            </label>
                            <p className="text-sm text-slate-800 dark:text-slate-200 mt-1">
                              {selectedCase.rca_prevention}
                            </p>
                          </div>
                        )}
                        
                        {selectedCase.rca_correction && (
                          <div>
                            <label className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                              整改措施
                            </label>
                            <p className="text-sm text-slate-800 dark:text-slate-200 mt-1">
                              {selectedCase.rca_correction}
                            </p>
                          </div>
                        )}
                      </>
                    )}

                    {/* 文档信息 */}
                    <div className="pt-4 border-t border-slate-100 dark:border-slate-700">
                      <h5 className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-3">
                        文档信息
                      </h5>
                      <div className="space-y-3">
                        <div>
                          <label className="text-xs text-slate-400 dark:text-slate-500">来源文档</label>
                          <p className="text-xs text-slate-600 dark:text-slate-400 mt-1 flex items-center gap-1">
                            <FileText className="h-3 w-3" />
                            {selectedCase.documents?.filename}
                          </p>
                        </div>
                        {selectedCase.source_slide && (
                          <div>
                            <label className="text-xs text-slate-400 dark:text-slate-500">来源页码</label>
                            <p className="text-xs text-slate-600 dark:text-slate-400 mt-1">
                              第 {selectedCase.source_slide} 页
                            </p>
                          </div>
                        )}
                        {selectedCase.document_images && (
                          <div>
                            <label className="text-xs text-slate-400 dark:text-slate-500">图片文件名</label>
                            <p className="text-xs text-slate-600 dark:text-slate-400 mt-1">
                              {selectedCase.document_images.filename}
                            </p>
                          </div>
                        )}
                        {selectedCase.document_images && (
                          <div>
                            <label className="text-xs text-slate-400 dark:text-slate-500">图片大小</label>
                            <p className="text-xs text-slate-600 dark:text-slate-400 mt-1">
                              {formatFileSize(selectedCase.document_images.file_size)}
                            </p>
                          </div>
                        )}
                        <div>
                          <label className="text-xs text-slate-400 dark:text-slate-500">创建时间</label>
                          <p className="text-xs text-slate-600 dark:text-slate-400 mt-1">
                            {new Date(selectedCase.created_at).toLocaleString("zh-CN")}
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
