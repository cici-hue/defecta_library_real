"use client";

import { createContext, useContext, useState, useEffect, ReactNode } from "react";

type Lang = "zh" | "en";

interface LanguageContextType {
  lang: Lang;
  setLang: (lang: Lang) => void;
  t: Record<string, string>;
}

const translations: Record<Lang, Record<string, string>> = {
  zh: {
    // Navigation
    "nav.admin": "管理后台",
    "nav.chat": "智能问答",
    "nav.knowledge": "知识浏览",
    "nav.newChat": "新对话",
    // Home page
    "home.title": "服装缺陷",
    "home.titleHighlight": "智能检索知识库",
    "home.subtitle": "基于 AI 大模型的多 Agent 协同系统，打造服装缺陷案例库与智能问答系统",
    "home.badge": "Multi-Agent + RAG + 图片检索",
    "home.btnPrimary": "开始问答",
    "home.btnSecondary": "上传文档",
    // Cards
    "card.docTitle": "文档管理",
    "card.docDesc": "上传行业文档（PPT/PDF/Word），AI 自动提取图片和缺陷信息并构建案例库",
    "card.docLink": "进入管理",
    "card.chatTitle": "智能问答",
    "card.chatDesc": "支持图片+文字混合查询，多 Agent 协同检索缺陷案例库生成精准回答",
    "card.chatLink": "开始问答",
    "card.knowledgeTitle": "知识浏览",
    "card.knowledgeDesc": "浏览 AI 提取的缺陷案例库，按文档/材料/索赔原因筛选查看详情",
    "card.knowledgeLink": "浏览知识",
    // Capabilities
    "cap.title": "核心能力",
    "cap.subtitle": "基于 Multi-Agent 架构的智能化解决方案",
    "cap.1.title": "图片提取",
    "cap.1.desc": "从 PPT/PDF 中自动提取缺陷图片",
    "cap.2.title": "智能识别",
    "cap.2.desc": "AI 分析图片关联缺陷信息",
    "cap.3.title": "混合检索",
    "cap.3.desc": "图片相似度 + 文本语义搜索",
    "cap.4.title": "案例构建",
    "cap.4.desc": "自动生成结构化缺陷案例",
    // Pipeline
    "pipeline.title": "多 Agent 协同工作流",
    "pipeline.subtitle": "六大 Agent 分两条 Pipeline 高效协作",
    "pipeline.a.title": "知识入库 Pipeline",
    "pipeline.a.subtitle": "文档 → 案例 → 知识库",
    "pipeline.a.step1": "文档提取",
    "pipeline.a.step1Desc": "自由阅读文档，提取所有有价值内容",
    "pipeline.a.step2": "缺陷案例提取",
    "pipeline.a.step2Desc": "分析幻灯片，关联图片与缺陷信息",
    "pipeline.a.step3": "知识库构建",
    "pipeline.a.step3Desc": "自主归纳，重建知识体系",
    "pipeline.a.step4": "向量入库",
    "pipeline.a.step4Desc": "生成 Embedding 向量，支持检索",
    "pipeline.b.title": "智能问答 Pipeline",
    "pipeline.b.subtitle": "用户提问 → 检索 → 回答",
    "pipeline.b.step1": "意图识别",
    "pipeline.b.step1Desc": "理解用户意图，判断是否在范围内",
    "pipeline.b.step2": "混合检索",
    "pipeline.b.step2Desc": "图片相似度 + 文本混合检索",
    "pipeline.b.step3": "案例排序",
    "pipeline.b.step3Desc": "智能筛选重排序候选案例",
    "pipeline.b.step4": "答案生成",
    "pipeline.b.step4Desc": "严格基于知识库流式生成回答",
    // Stats
    "stat.1.label": "AI Agents",
    "stat.1.sub": "协同工作",
    "stat.2.label": "Pipelines",
    "stat.2.sub": "独立流程",
    "stat.3.label": "扩展性",
    "stat.3.sub": "持续学习",
    "stat.4.label": "准确率",
    "stat.4.sub": "知识边界约束",
    // Footer
    "footer.main": "Defect Library — AI-Powered Fashion Industry Knowledge Base",
    "footer.tech": "基于 Next.js · Supabase · Multi-Agent Architecture",
    // Chat page
    "chat.hero.title": "Defect Library",
    "chat.hero.subtitle": "服装行业智能缺陷案例库 · AI 驱动的知识问答系统",
    "chat.hero.description": "可视化 AI 操作管理的云空间，为数据探索而生，让开发更简单。上传缺陷图片或输入问题，AI 将基于知识库为您查找相关案例。",
    "chat.input.placeholder": "请输入你的问题...",
    "chat.input.imageBtn": "图片",
    "chat.input.hint": "⚡ 支持图片 + 文字混合查询",
    "chat.quick.title": "不知道可以做什么？",
    "chat.quick.subtitle": "探索一下这个领域，我可以帮你做什么",
    "chat.quick.category1": "常见缺陷查询",
    "chat.quick.q1_1": "布面横档是什么原因造成的？",
    "chat.quick.q1_2": "如何检测色差缺陷？",
    "chat.quick.q1_3": "常见的缝制缺陷有哪些？",
    "chat.quick.category2": "材料与工艺",
    "chat.quick.q2_1": "Polyamide材料常见问题",
    "chat.quick.q2_2": "文胸类产品主要缺陷类型",
    "chat.quick.q2_3": "包装缺陷有哪些？",
    "chat.quick.category3": "案例分析与预防",
    "chat.quick.q3_1": "Armhole wavy的预防措施",
    "chat.quick.q3_2": "Frayed Yarn的处理方法",
    "chat.quick.q3_3": "色牢度问题的解决方案",
    "chat.quick.category4": "图片查询",
    "chat.quick.q4_1": "上传图片查找相似案例",
    "chat.quick.q4_2": "根据图片判断缺陷原因",
    "chat.history.title": "历史对话",
    "chat.defaultQuestion": "请分析这张图片中的缺陷案例",
    "chat.uploadedImage": "(上传了图片)",
    "chat.errorMsg": "请求失败，请稍后重试。",
    "chat.sourcesLabel": "引用来源:",
    "chat.casePrefix": "案例 ",
    // Knowledge page
    "knowledge.title": "知识浏览",
    "knowledge.subtitle": "浏览 AI 提取的服装行业缺陷案例库",
    "knowledge.filter.all": "全部",
    "knowledge.filter.document": "按文档筛选",
    "knowledge.filter.material": "按材料筛选",
    "knowledge.filter.claimReason": "按索赔原因筛选",
    "knowledge.filter.keyword": "关键词搜索...",
    "knowledge.noCases": "暂无缺陷案例",
    "knowledge.noCasesHint": "请先在管理后台上传文档并处理",
    "knowledge.caseCount": "个缺陷案例",
    "knowledge.detail.title": "案例详情",
    "knowledge.detail.close": "关闭",
    "knowledge.detail.material": "材料",
    "knowledge.detail.position": "位置",
    "knowledge.detail.claimReason": "索赔原因",
    "knowledge.detail.defectDescription": "缺陷描述",
    "knowledge.detail.style": "款式",
    "knowledge.detail.sourceDoc": "来源文档",
    "knowledge.detail.relatedImages": "相关图片",
  },
  en: {
    // Navigation
    "nav.admin": "Admin",
    "nav.chat": "Q&A",
    "nav.knowledge": "Knowledge",
    "nav.newChat": "New Chat",
    // Home page
    "home.title": "Fashion Defect",
    "home.titleHighlight": "Intelligent Retrieval System",
    "home.subtitle": "AI-powered Multi-Agent system for fashion defect case library & intelligent Q&A",
    "home.badge": "Multi-Agent + RAG + Image Search",
    "home.btnPrimary": "Start Chat",
    "home.btnSecondary": "Upload Docs",
    // Cards
    "card.docTitle": "Document Management",
    "card.docDesc": "Upload documents (PPT/PDF/Word), AI extracts images and defect info to build case library",
    "card.docLink": "Go to Admin",
    "card.chatTitle": "Intelligent Q&A",
    "card.chatDesc": "Image + text hybrid query, multi-agent retrieval for precise answers",
    "card.chatLink": "Start Chat",
    "card.knowledgeTitle": "Knowledge Browse",
    "card.knowledgeDesc": "Browse AI-extracted defect cases, filter by document/material/claim reason",
    "card.knowledgeLink": "Browse Knowledge",
    // Capabilities
    "cap.title": "Core Capabilities",
    "cap.subtitle": "Intelligent solutions based on Multi-Agent architecture",
    "cap.1.title": "Image Extraction",
    "cap.1.desc": "Auto-extract defect images from PPT/PDF",
    "cap.2.title": "Smart Recognition",
    "cap.2.desc": "AI analyzes images and links defect info",
    "cap.3.title": "Hybrid Retrieval",
    "cap.3.desc": "Image similarity + text semantic search",
    "cap.4.title": "Case Building",
    "cap.4.desc": "Auto-generate structured defect cases",
    // Pipeline
    "pipeline.title": "Multi-Agent Workflow",
    "pipeline.subtitle": "6 Agents in 2 Pipelines working together",
    "pipeline.a.title": "Knowledge Ingestion Pipeline",
    "pipeline.a.subtitle": "Document → Cases → Knowledge Base",
    "pipeline.a.step1": "Document Extraction",
    "pipeline.a.step1Desc": "Read documents freely, extract all valuable content",
    "pipeline.a.step2": "Defect Case Extraction",
    "pipeline.a.step2Desc": "Analyze slides, link images with defect info",
    "pipeline.a.step3": "Knowledge Building",
    "pipeline.a.step3Desc": "Autonomously summarize, rebuild knowledge system",
    "pipeline.a.step4": "Vector Storage",
    "pipeline.a.step4Desc": "Generate Embedding vectors for retrieval",
    "pipeline.b.title": "Intelligent Q&A Pipeline",
    "pipeline.b.subtitle": "User Query → Retrieve → Answer",
    "pipeline.b.step1": "Intent Recognition",
    "pipeline.b.step1Desc": "Understand user intent, check scope",
    "pipeline.b.step2": "Hybrid Search",
    "pipeline.b.step2Desc": "Image similarity + text hybrid search",
    "pipeline.b.step3": "Case Ranking",
    "pipeline.b.step3Desc": "Smart filtering and reranking of candidates",
    "pipeline.b.step4": "Answer Generation",
    "pipeline.b.step4Desc": "Streaming answer strictly from knowledge base",
    // Stats
    "stat.1.label": "AI Agents",
    "stat.1.sub": "Collaborative",
    "stat.2.label": "Pipelines",
    "stat.2.sub": "Independent",
    "stat.3.label": "Scalability",
    "stat.3.sub": "Continuous Learning",
    "stat.4.label": "Accuracy",
    "stat.4.sub": "Boundary Constraints",
    // Footer
    "footer.main": "Defect Library — AI-Powered Fashion Defect Knowledge Base",
    "footer.tech": "Powered by Next.js · Supabase · Multi-Agent Architecture",
    // Chat page
    "chat.hero.title": "Defect Library",
    "chat.hero.subtitle": "Fashion Defect Case Library · AI-Powered Knowledge Q&A System",
    "chat.hero.description": "A cloud space for visual AI operation management, born for data exploration, making development simpler. Upload defect images or enter questions, and AI will find relevant cases from the knowledge base.",
    "chat.input.placeholder": "Enter your question...",
    "chat.input.imageBtn": "Image",
    "chat.input.hint": "⚡ Supports image + text hybrid queries",
    "chat.quick.title": "Not sure what to do?",
    "chat.quick.subtitle": "Explore this domain, see what I can help with",
    "chat.quick.category1": "Common Defect Queries",
    "chat.quick.q1_1": "What causes barre marks on fabric?",
    "chat.quick.q1_2": "How to detect color difference defects?",
    "chat.quick.q1_3": "What are common sewing defects?",
    "chat.quick.category2": "Materials & Process",
    "chat.quick.q2_1": "Common issues with Polyamide materials",
    "chat.quick.q2_2": "Main defect types for bra products",
    "chat.quick.q2_3": "What are packing defects?",
    "chat.quick.category3": "Case Analysis & Prevention",
    "chat.quick.q3_1": "Prevention measures for Armhole wavy",
    "chat.quick.q3_2": "How to handle Frayed Yarn",
    "chat.quick.q3_3": "Solutions for color fastness issues",
    "chat.quick.category4": "Image Search",
    "chat.quick.q4_1": "Upload image to find similar cases",
    "chat.quick.q4_2": "Identify defect cause from image",
    "chat.history.title": "History",
    "chat.defaultQuestion": "Please analyze the defect case in this image",
    "chat.uploadedImage": "(Image uploaded)",
    "chat.errorMsg": "Request failed, please try again later.",
    "chat.sourcesLabel": "Sources:",
    "chat.casePrefix": "Case ",
    // Knowledge page
    "knowledge.title": "Knowledge Browse",
    "knowledge.subtitle": "Browse AI-extracted fashion industry defect case library",
    "knowledge.filter.all": "All",
    "knowledge.filter.document": "Filter by Document",
    "knowledge.filter.material": "Filter by Material",
    "knowledge.filter.claimReason": "Filter by Claim Reason",
    "knowledge.filter.keyword": "Search keywords...",
    "knowledge.noCases": "No defect cases yet",
    "knowledge.noCasesHint": "Please upload documents in admin panel first",
    "knowledge.caseCount": "defect cases",
    "knowledge.detail.title": "Case Details",
    "knowledge.detail.close": "Close",
    "knowledge.detail.material": "Material",
    "knowledge.detail.position": "Position",
    "knowledge.detail.claimReason": "Claim Reason",
    "knowledge.detail.defectDescription": "Defect Description",
    "knowledge.detail.style": "Style",
    "knowledge.detail.sourceDoc": "Source Document",
    "knowledge.detail.relatedImages": "Related Images",
  },
};

const LanguageContext = createContext<LanguageContextType>({
  lang: "zh",
  setLang: () => {},
  t: translations.zh,
});

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>("zh");

  useEffect(() => {
    const saved = localStorage.getItem("defect-lang") as Lang | null;
    if (saved && (saved === "zh" || saved === "en")) {
      setLangState(saved);
    }
  }, []);

  const setLang = (newLang: Lang) => {
    setLangState(newLang);
    localStorage.setItem("defect-lang", newLang);
  };

  const t = translations[lang];

  return (
    <LanguageContext.Provider value={{ lang, setLang, t }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  return useContext(LanguageContext);
}

export default LanguageContext;
