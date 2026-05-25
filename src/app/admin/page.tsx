"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import {
  BookOpen,
  MessageSquare,
  Upload,
  FileText,
  Trash2,
  Loader2,
  CheckCircle,
  XCircle,
  Clock,
  RefreshCw,
  BarChart3,
} from "lucide-react";

interface Document {
  id: string;
  filename: string;
  file_type: string;
  file_size: number;
  status: "pending" | "processing" | "completed" | "failed";
  created_at: string;
}

interface Stats {
  documents: { total: number; completed: number; processing: number };
  knowledge: { total_chunks: number; schema_version: number; schema_description: string; last_updated: string | null };
  chat: { total_sessions: number };
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function StatusBadge({ status }: { status: Document["status"] }) {
  const config = {
    pending: { icon: Clock, label: "待处理", color: "text-slate-500 bg-slate-50" },
    processing: { icon: Loader2, label: "处理中", color: "text-blue-600 bg-blue-50 animate-spin" },
    completed: { icon: CheckCircle, label: "已完成", color: "text-green-600 bg-green-50" },
    failed: { icon: XCircle, label: "失败", color: "text-red-600 bg-red-50" },
  };
  const { icon: Icon, label, color } = config[status];
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${color}`}>
      <Icon className="h-3 w-3" />
      {label}
    </span>
  );
}

export default function AdminPage() {
  const [documents, setDocuments] = useState<Document[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [uploading, setUploading] = useState(false);
  const [loading, setLoading] = useState(true);

  const fetchDocuments = useCallback(async () => {
    try {
      const res = await fetch("/api/documents");
      const data = await res.json();
      if (data.documents) setDocuments(data.documents);
    } catch (err) {
      console.error("Failed to fetch documents:", err);
    }
  }, []);

  const fetchStats = useCallback(async () => {
    try {
      const res = await fetch("/api/stats");
      const data = await res.json();
      if (data.documents) setStats(data);
    } catch (err) {
      console.error("Failed to fetch stats:", err);
    }
  }, []);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      await Promise.all([fetchDocuments(), fetchStats()]);
      setLoading(false);
    };
    load();
    // Auto-refresh every 5s to catch processing status changes
    const interval = setInterval(fetchDocuments, 5000);
    return () => clearInterval(interval);
  }, [fetchDocuments, fetchStats]);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setUploading(true);
    try {
      for (const file of Array.from(files)) {
        const formData = new FormData();
        formData.append("file", file);
        const res = await fetch("/api/documents", { method: "POST", body: formData });
        const data = await res.json();
        if (data.error) {
          alert(`上传 ${file.name} 失败: ${data.error}`);
        }
      }
      await fetchDocuments();
      await fetchStats();
    } catch (err) {
      console.error("Upload failed:", err);
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  };

  const handleProcess = async (docId: string) => {
    try {
      const res = await fetch(`/api/documents/${docId}/process`, { method: "POST" });
      const data = await res.json();
      if (data.error) {
        alert(`处理失败: ${data.error}`);
      } else {
        await fetchDocuments();
      }
    } catch (err) {
      console.error("Process failed:", err);
    }
  };

  const handleDelete = async (docId: string) => {
    if (!confirm("确定删除此文档？")) return;
    try {
      await fetch(`/api/documents/${docId}`, { method: "DELETE" });
      await fetchDocuments();
      await fetchStats();
    } catch (err) {
      console.error("Delete failed:", err);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950">
      {/* Header */}
      <header className="border-b bg-white dark:bg-slate-900">
        <div className="mx-auto max-w-6xl px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-6">
            <Link href="/" className="flex items-center gap-2 text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white">
              <BookOpen className="h-6 w-6" />
              <span className="font-bold">Defect Library</span>
            </Link>
            <nav className="flex items-center gap-4">
              <span className="text-sm font-medium text-blue-600 dark:text-blue-400">管理后台</span>
              <Link href="/chat" className="text-sm text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-white">
                智能问答
              </Link>
              <Link href="/knowledge" className="text-sm text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-white">
                知识浏览
              </Link>
            </nav>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-6 py-8">
        {/* Stats */}
        {stats && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
            <div className="p-4 bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700">
              <div className="flex items-center gap-2 text-slate-500 dark:text-slate-400 text-sm mb-1">
                <FileText className="h-4 w-4" />
                文档总数
              </div>
              <div className="text-2xl font-bold text-slate-900 dark:text-white">
                {stats.documents.total}
              </div>
            </div>
            <div className="p-4 bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700">
              <div className="flex items-center gap-2 text-slate-500 dark:text-slate-400 text-sm mb-1">
                <CheckCircle className="h-4 w-4" />
                已处理
              </div>
              <div className="text-2xl font-bold text-green-600">{stats.documents.completed}</div>
            </div>
            <div className="p-4 bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700">
              <div className="flex items-center gap-2 text-slate-500 dark:text-slate-400 text-sm mb-1">
                <BarChart3 className="h-4 w-4" />
                知识条目
              </div>
              <div className="text-2xl font-bold text-blue-600">{stats.knowledge.total_chunks}</div>
            </div>
            <div className="p-4 bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700">
              <div className="flex items-center gap-2 text-slate-500 dark:text-slate-400 text-sm mb-1">
                <BookOpen className="h-4 w-4" />
                知识体系版本
              </div>
              <div className="text-2xl font-bold text-purple-600">v{stats.knowledge.schema_version}</div>
            </div>
          </div>
        )}

        {/* Upload Area */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-slate-900 dark:text-white">文档上传</h2>
            <button
              onClick={() => { fetchDocuments(); fetchStats(); }}
              className="text-sm text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-white flex items-center gap-1"
            >
              <RefreshCw className="h-3 w-3" />
              刷新
            </button>
          </div>

          <label className="flex flex-col items-center justify-center w-full h-40 border-2 border-dashed border-slate-300 dark:border-slate-600 rounded-xl cursor-pointer hover:border-blue-400 hover:bg-blue-50/50 dark:hover:border-blue-500 dark:hover:bg-blue-950/20 transition-colors">
            {uploading ? (
              <div className="flex items-center gap-2 text-blue-600">
                <Loader2 className="h-5 w-5 animate-spin" />
                <span className="text-sm font-medium">上传中...</span>
              </div>
            ) : (
              <>
                <Upload className="h-8 w-8 text-slate-400 mb-2" />
                <span className="text-sm text-slate-600 dark:text-slate-400 font-medium">
                  点击上传文档
                </span>
                <span className="text-xs text-slate-400 mt-1">
                  支持 Word、PPT、PDF、Excel、图片、文本等多种格式
                </span>
              </>
            )}
            <input
              type="file"
              className="hidden"
              multiple
              accept=".doc,.docx,.ppt,.pptx,.pdf,.xls,.xlsx,.txt,.md,.csv,.json,.text,.png,.jpg,.jpeg,.gif,.bmp,.webp"
              onChange={handleUpload}
              disabled={uploading}
            />
          </label>
        </div>

        {/* Document List */}
        <div>
          <h2 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">文档列表</h2>
          {loading ? (
            <div className="flex items-center justify-center py-12 text-slate-400">
              <Loader2 className="h-5 w-5 animate-spin mr-2" />
              加载中...
            </div>
          ) : documents.length === 0 ? (
            <div className="text-center py-12 text-slate-400">
              <FileText className="h-12 w-12 mx-auto mb-3 opacity-50" />
              <p>暂无文档，请上传文档开始构建知识库</p>
            </div>
          ) : (
            <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 divide-y divide-slate-100 dark:divide-slate-700">
              {documents.map((doc) => (
                <div key={doc.id} className="flex items-center justify-between px-5 py-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <FileText className="h-5 w-5 text-slate-400 shrink-0" />
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-slate-900 dark:text-white truncate">
                        {doc.filename}
                      </p>
                      <p className="text-xs text-slate-400">
                        {formatFileSize(doc.file_size)} · {new Date(doc.created_at).toLocaleString("zh-CN")}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <StatusBadge status={doc.status} />
                    {doc.status === "pending" && (
                      <button
                        onClick={() => handleProcess(doc.id)}
                        className="text-xs px-3 py-1 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
                      >
                        处理
                      </button>
                    )}
                    {doc.status === "failed" && (
                      <button
                        onClick={() => handleProcess(doc.id)}
                        className="text-xs px-3 py-1 bg-orange-500 text-white rounded-md hover:bg-orange-600 transition-colors"
                      >
                        重试
                      </button>
                    )}
                    <button
                      onClick={() => handleDelete(doc.id)}
                      className="p-1 text-slate-400 hover:text-red-500 transition-colors"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
