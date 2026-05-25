"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import Link from "next/link";
import {
  Send,
  Loader2,
  MessageSquare,
  Plus,
  Trash2,
  Image as ImageIcon,
  X,
  ChevronRight,
  Sparkles,
  Globe,
} from "lucide-react";
import { useLanguage } from "@/lib/language-context";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  sources?: Array<{ chunk_id: string; relevance: string; reason: string }>;
  isStreaming?: boolean;
  image?: {
    filename: string;
    url: string;
  };
}

export default function ChatPage() {
  const { lang, setLang, t } = useLanguage();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [sessions, setSessions] = useState<Array<{ id: string; title: string; created_at: string }>>([]);
  const [uploadedImage, setUploadedImage] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const fetchSessions = useCallback(async () => {
    try {
      const res = await fetch("/api/sessions");
      const data = await res.json();
      if (data.sessions) setSessions(data.sessions);
    } catch (err) {
      console.error("Failed to fetch sessions:", err);
    }
  }, []);

  useEffect(() => {
    fetchSessions();
  }, [fetchSessions]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleNewChat = () => {
    setMessages([]);
    setSessionId(null);
    setInput("");
    setUploadedImage(null);
    setImagePreview(null);
    inputRef.current?.focus();
  };

  const handleSelectSession = async (sid: string) => {
    try {
      const res = await fetch(`/api/sessions?session_id=${sid}`);
      const data = await res.json();
      if (data.messages) {
        setSessionId(sid);
        setMessages(
          data.messages.map((m: { id: string; role: string; content: string; sources: unknown }) => ({
            id: m.id,
            role: m.role as "user" | "assistant",
            content: m.content,
            sources: Array.isArray(m.sources) ? m.sources : undefined,
          }))
        );
      }
    } catch (err) {
      console.error("Failed to load session:", err);
    }
  };

  const handleDeleteSession = async (sid: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await fetch(`/api/sessions?session_id=${sid}`, { method: "DELETE" });
      if (sessionId === sid) handleNewChat();
      await fetchSessions();
    } catch (err) {
      console.error("Failed to delete session:", err);
    }
  };

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setUploadedImage(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleRemoveImage = () => {
    setUploadedImage(null);
    setImagePreview(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleSend = async () => {
    const question = input.trim();
    if ((!question && !uploadedImage) || isLoading) return;

    let imageDataBase64: string | null = null;
    let imageMimeType: string | null = null;

    if (uploadedImage) {
      imageDataBase64 = await new Promise((resolve) => {
        const reader = new FileReader();
        reader.onloadend = () => {
          const result = reader.result as string;
          resolve(result.split(",")[1]);
        };
        reader.readAsDataURL(uploadedImage);
      });
      imageMimeType = uploadedImage.type;
    }

    const userMsg: Message = {
      id: `user-${Date.now()}`,
      role: "user",
      content: question || t["chat.defaultQuestion"],
      image: uploadedImage && imagePreview ? {
        filename: uploadedImage.name,
        url: imagePreview,
      } : undefined,
    };

    const assistantMsg: Message = {
      id: `assistant-${Date.now()}`,
      role: "assistant",
      content: "",
      isStreaming: true,
    };

    setMessages((prev) => [...prev, userMsg, assistantMsg]);
    setInput("");
    setUploadedImage(null);
    setImagePreview(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
    setIsLoading(true);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          question: question || t["chat.defaultQuestion"],
          session_id: sessionId,
          image_data: imageDataBase64,
          image_mime_type: imageMimeType,
        }),
      });

      if (!res.ok) {
        throw new Error("请求失败");
      }

      const reader = res.body?.getReader();
      if (!reader) throw new Error("无法读取流");

      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          if (line.startsWith("data: ")) {
            try {
              const data = JSON.parse(line.slice(6));
              if (data.type === "session") {
                setSessionId(data.session_id);
                fetchSessions();
              } else if (data.type === "content") {
                setMessages((prev) => {
                  const updated = [...prev];
                  const lastMsg = updated[updated.length - 1];
                  if (lastMsg.role === "assistant") {
                    updated[updated.length - 1] = {
                      ...lastMsg,
                      content: lastMsg.content + data.content,
                    };
                  }
                  return updated;
                });
              } else if (data.type === "error") {
                setMessages((prev) => {
                  const updated = [...prev];
                  const lastMsg = updated[updated.length - 1];
                  if (lastMsg.role === "assistant") {
                    updated[updated.length - 1] = {
                      ...lastMsg,
                      content: `出错了: ${data.error}`,
                      isStreaming: false,
                    };
                  }
                  return updated;
                });
              } else if (data.type === "done") {
                setMessages((prev) => {
                  const updated = [...prev];
                  const lastMsg = updated[updated.length - 1];
                  if (lastMsg.role === "assistant") {
                    updated[updated.length - 1] = {
                      ...lastMsg,
                      isStreaming: false,
                    };
                  }
                  return updated;
                });
              }
            } catch {
              // skip unparseable lines
            }
          }
        }
      }
    } catch (err) {
      setMessages((prev) => {
        const updated = [...prev];
        const lastMsg = updated[updated.length - 1];
        if (lastMsg.role === "assistant") {
          updated[updated.length - 1] = {
            ...lastMsg,
            content: t["chat.errorMsg"],
            isStreaming: false,
          };
        }
        return updated;
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const quickQuestions = [
    {
      category: t["chat.quick.category1"],
      questions: [t["chat.quick.q1_1"], t["chat.quick.q1_2"], t["chat.quick.q1_3"]],
    },
    {
      category: t["chat.quick.category2"],
      questions: [t["chat.quick.q2_1"], t["chat.quick.q2_2"], t["chat.quick.q2_3"]],
    },
    {
      category: t["chat.quick.category3"],
      questions: [t["chat.quick.q3_1"], t["chat.quick.q3_2"], t["chat.quick.q3_3"]],
    },
    {
      category: t["chat.quick.category4"],
      questions: [t["chat.quick.q4_1"], t["chat.quick.q4_2"]],
    },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-50/30 via-white to-blue-50/30">
      {/* Header */}
      <header className="fixed top-0 left-0 right-0 bg-white/80 backdrop-blur-md border-b border-gray-100 z-50">
        <div className="max-w-6xl mx-auto px-4 h-14 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-orange-400 to-orange-500 flex items-center justify-center shadow-sm">
              <Sparkles className="h-4 w-4 text-white" />
            </div>
            <span className="font-semibold text-lg text-gray-800">Defect Library</span>
          </Link>
          
          <nav className="flex items-center gap-1">
            <button
              onClick={() => setLang(lang === "zh" ? "en" : "zh")}
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-gray-600 hover:text-gray-900 hover:bg-gray-50 rounded-lg transition-colors"
            >
              <Globe className="h-4 w-4" />
              {lang === "zh" ? "EN" : "中文"}
            </button>
            <button
              onClick={handleNewChat}
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-gray-600 hover:text-gray-900 hover:bg-gray-50 rounded-lg transition-colors"
            >
              <Plus className="h-4 w-4" />
              {t["nav.newChat"]}
            </button>
            <Link href="/admin" className="px-3 py-1.5 text-sm font-medium text-gray-600 hover:text-gray-900 hover:bg-gray-50 rounded-lg transition-colors">
              {t["nav.admin"]}
            </Link>
            <Link href="/knowledge" className="px-3 py-1.5 text-sm font-medium text-gray-600 hover:text-gray-900 hover:bg-gray-50 rounded-lg transition-colors">
              {t["nav.knowledge"]}
            </Link>
          </nav>
        </div>
      </header>

      {/* Main Content */}
      <main className="pt-20 pb-8">
        <div className="max-w-3xl mx-auto px-4">
          {/* Hero Section - Only show when no messages */}
          {messages.length === 0 ? (
            <div className="text-center mb-10">
              <div className="inline-flex items-center gap-3 mb-4">
                <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-orange-100 to-orange-50 border border-orange-200 flex items-center justify-center">
                  <span className="text-2xl">🔍</span>
                </div>
                <div className="text-left">
                  <h1 className="text-2xl font-bold text-gray-900">{t["chat.hero.title"]}</h1>
                  <p className="text-sm text-gray-500 mt-0.5">{t["chat.hero.subtitle"]}</p>
                </div>
              </div>

              <p className="text-gray-500 max-w-lg mx-auto mt-4 leading-relaxed">
                {lang === "zh"
                  ? "上传缺陷图片或输入问题，AI 将基于知识库为您查找相关案例。"
                  : "Upload defect images or enter questions, AI will find relevant cases from the knowledge base."}
              </p>
            </div>
          ) : (
            /* Messages */
            <div className="space-y-6 mb-8">
              {messages.map((msg) => (
                <div
                  key={msg.id}
                  className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
                >
                  <div
                    className={`max-w-[85%] rounded-2xl ${
                      msg.role === "user"
                        ? "bg-gradient-to-br from-orange-500 to-orange-600 text-white px-5 py-3"
                        : "bg-white border border-gray-100 shadow-sm px-5 py-3"
                    }`}
                  >
                    {msg.image && msg.image.url && (
                      <div className="mb-3">
                        <img
                          src={msg.image.url}
                          alt={msg.image.filename}
                          className="max-w-full h-auto rounded-xl shadow-sm"
                        />
                        <p className="text-xs text-orange-200 mt-1.5">{msg.image.filename}</p>
                      </div>
                    )}
                    
                    {msg.content && (
                      <div className={`text-sm leading-relaxed ${msg.role === "user" ? "text-white" : "text-gray-700"}`}>
                        {msg.content}
                        {msg.isStreaming && (
                          <span className="inline-block w-1.5 h-4 bg-current ml-0.5 animate-pulse opacity-70" />
                        )}
                      </div>
                    )}

                    {msg.role === "assistant" && !msg.isStreaming && msg.sources && msg.sources.length > 0 && (
                      <div className="mt-3 pt-3 border-t border-gray-100">
                        <p className="text-xs text-gray-400 mb-2">{t["chat.sourcesLabel"]}</p>
                        <div className="flex flex-wrap gap-1.5">
                          {msg.sources.map((s, i) => (
                            <span
                              key={i}
                              className={`text-xs px-2 py-1 rounded-full ${
                                s.relevance === "high"
                                  ? "bg-green-50 text-green-600 border border-green-100"
                                  : s.relevance === "medium"
                                  ? "bg-yellow-50 text-yellow-600 border border-yellow-100"
                                  : "bg-gray-50 text-gray-500 border border-gray-100"
                              }`}
                            >
                              {t["chat.casePrefix"]}{s.chunk_id.slice(0, 8)}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              ))}
              <div ref={messagesEndRef} />
            </div>
          )}

          {/* Input Area */}
          <div className="bg-white rounded-2xl shadow-lg border border-gray-100 p-4">
            {/* Image Preview */}
            {imagePreview && (
              <div className="mb-3 flex items-start gap-3 p-3 bg-orange-50 rounded-xl border border-orange-100">
                <img
                  src={imagePreview}
                  alt="Preview"
                  className="h-20 w-auto rounded-lg object-cover"
                />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-700 truncate">{uploadedImage?.name}</p>
                  <p className="text-xs text-gray-500 mt-0.5">{lang === "zh" ? "点击发送将一起提交" : "Click send to submit together"}</p>
                </div>
                <button
                  onClick={handleRemoveImage}
                  className="p-1 text-gray-400 hover:text-red-500 transition-colors"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            )}

            {/* Text Input */}
            <textarea
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={t["chat.input.placeholder"]}
              rows={3}
              className="w-full resize-none border-0 bg-transparent text-gray-800 placeholder:text-gray-400 focus:outline-none text-base leading-relaxed"
              disabled={isLoading}
            />

            {/* Input Footer */}
            <div className="flex items-center justify-between mt-3 pt-3 border-t border-gray-50">
              <div className="flex items-center gap-2">
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleImageSelect}
                  accept="image/*"
                  className="hidden"
                />
                <button
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isLoading}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-gray-500 hover:text-orange-600 hover:bg-orange-50 rounded-lg transition-colors"
                  title={t["chat.input.imageBtn"]}
                >
                  <ImageIcon className="h-4 w-4" />
                  {t["chat.input.imageBtn"]}
                </button>
                
                <div className="h-4 w-px bg-gray-200 mx-1" />
                
                <span className="text-xs text-gray-400">
                  {t["chat.input.hint"]}
                </span>
              </div>

              <button
                onClick={handleSend}
                disabled={isLoading || (!input.trim() && !uploadedImage)}
                className="flex items-center justify-center w-9 h-9 rounded-xl bg-gradient-to-r from-orange-500 to-orange-600 text-white shadow-sm hover:shadow-md disabled:opacity-40 disabled:cursor-not-allowed transition-all"
              >
                {isLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Send className="h-4 w-4" />
                )}
              </button>
            </div>
          </div>

          {/* Quick Questions - Only show when no messages */}
          {messages.length === 0 && (
            <div className="mt-8">
              <div className="flex items-center gap-2 mb-4">
                <div className="w-7 h-7 rounded-full bg-orange-100 flex items-center justify-center">
                  <Sparkles className="h-3 w-3 text-orange-600" />
                </div>
                <h3 className="text-sm font-medium text-gray-700">{t["chat.quick.title"]}</h3>
                <p className="text-xs text-gray-400">{t["chat.quick.subtitle"]}</p>
              </div>

              <div className="grid grid-cols-2 gap-3">
                {quickQuestions.map((category, idx) => (
                  <div key={idx}>
                    <div className="flex items-center gap-1.5 mb-2 px-1">
                      <div className="w-1 h-3 rounded-full bg-orange-400" />
                      <span className="text-xs font-medium text-gray-600">{category.category}</span>
                    </div>
                    <div className="space-y-1.5">
                      {category.questions.map((q, qIdx) => (
                        <button
                          key={qIdx}
                          onClick={() => {
                            setInput(q);
                            inputRef.current?.focus();
                            if (q.includes("上传图片")) {
                              fileInputRef.current?.click();
                            }
                          }}
                          className="w-full flex items-center justify-between group px-3 py-2.5 bg-white hover:bg-orange-50/50 border border-gray-100 hover:border-orange-200 rounded-xl text-left transition-all"
                        >
                          <span className="text-sm text-gray-600 group-hover:text-gray-900 truncate pr-2">{q}</span>
                          <ChevronRight className="h-3 w-3 text-gray-300 group-hover:text-orange-500 shrink-0 transition-colors" />
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Sessions List - Sidebar style at bottom on mobile */}
          {sessions.length > 0 && messages.length === 0 && (
            <div className="mt-8 pt-6 border-t border-gray-100">
              <h3 className="text-sm font-medium text-gray-500 mb-3">{t["chat.history.title"]}</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                {sessions.slice(0, 6).map((s) => (
                  <button
                    key={s.id}
                    onClick={() => handleSelectSession(s.id)}
                    className="group flex items-center justify-between px-3 py-2 bg-white hover:bg-gray-50 border border-gray-100 rounded-lg text-left transition-all"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <MessageSquare className="h-3 w-3 text-gray-400 shrink-0" />
                      <span className="text-sm text-gray-600 truncate">{s.title || "新对话"}</span>
                    </div>
                    <button
                      onClick={(e) => handleDeleteSession(s.id, e)}
                      className="opacity-0 group-hover:opacity-100 p-1 text-gray-400 hover:text-red-500 transition-all"
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
