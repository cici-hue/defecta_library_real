# AGENTS.md

## 项目概览

**Defect Library** — 基于AI大模型的服装行业智能知识库系统。采用 Multi-Agent 协同架构，5 个 Prompt 驱动的 Agent 分两条 Pipeline 协作完成知识入库和智能问答。

### 版本技术栈

- **Framework**: Next.js 16 (App Router)
- **Core**: React 19
- **Language**: TypeScript 5
- **UI 组件**: shadcn/ui (基于 Radix UI)
- **Styling**: Tailwind CSS 4
- **Database**: Supabase (PostgreSQL)
- **LLM**: coze-coding-dev-sdk (doubao-seed 系列)
- **Embedding**: coze-coding-dev-sdk (doubao-embedding)
- **Storage**: S3 兼容对象存储 (coze-coding-dev-sdk)

## 目录结构

```
├── src/
│   ├── app/
│   │   ├── page.tsx                    # 首页
│   │   ├── layout.tsx                  # 根布局
│   │   ├── globals.css                 # 全局样式
│   │   ├── admin/page.tsx              # 管理后台（文档上传/管理）
│   │   ├── chat/page.tsx               # 智能问答页面（SSE流式对话）
│   │   ├── knowledge/page.tsx          # 知识浏览页面
│   │   └── api/
│   │       ├── documents/route.ts      # 文档 CRUD API
│   │       ├── documents/[id]/route.ts # 文档删除
│   │       ├── documents/[id]/process/route.ts # 文档处理（触发Agent Pipeline A）
│   │       ├── chat/route.ts           # 问答 API（SSE流式，触发Agent Pipeline B）
│   │       ├── knowledge/route.ts      # 知识库查询 API
│   │       ├── stats/route.ts          # 统计数据 API
│   │       └── sessions/route.ts       # 对话会话 API
│   ├── lib/
│   │   ├── agents/
│   │   │   ├── prompts.ts              # 5个Agent的System Prompt定义
│   │   │   ├── orchestration.ts        # Agent调度层（LLM/Embedding调用）
│   │   │   └── pipelines.ts            # Pipeline A/B 实现
│   │   └── utils.ts                    # 通用工具函数
│   ├── storage/database/
│   │   ├── supabase-client.ts          # Supabase客户端
│   │   └── shared/schema.ts            # 数据库Schema定义
│   └── components/ui/                  # shadcn/ui 组件
├── public/                             # 静态资源
├── .coze                               # Coze配置
├── package.json
└── tsconfig.json
```

## 核心架构

### Agent 架构原则

**Agent = System Prompt + Tool Use**，所有业务智能在 Prompt 中，代码层只负责数据流传递。

### 5 个 Agent

| Agent | Pipeline | 职责 | 模型 |
|-------|----------|------|------|
| doc-extraction | A | 自由阅读文档，提取所有有价值的内容要点 | doubao-seed-2-0-pro |
| knowledge-construction | A | 综合归纳多文档提取结果，自主构建知识体系 | doubao-seed-2-0-pro |
| intent-recognition | B | 理解用户意图，判断是否属于知识库范围，生成多角度检索查询 | doubao-seed-2-0-lite |
| knowledge-retrieval | B | 对候选知识块做智能筛选和重排序 | doubao-seed-2-0-lite |
| answer-generation | B | 严格基于知识库内容生成回答（流式） | doubao-seed-2-0-pro |

### Pipeline A: 知识入库

```
文档上传 → S3存储 → 管理员点击"处理"
  → 文档提取Agent（自由提取，不限结构）
  → 知识库构建Agent（自主归纳，重建知识体系）
  → 生成Embedding → 入库
```

### Pipeline B: 智能问答

```
用户提问 → 意图识别Agent → [out_of_scope → 拒绝]
                         → [in_scope → 混合检索(向量+关键词)]
  → 知识检索Agent（智能筛选/重排序）
  → [无相关 → 拒绝]
  → 答案生成Agent（SSE流式，严格基于知识库）
```

### 知识边界约束（三层卡口）

1. **意图识别层**：判断是否属于服装行业领域
2. **知识检索层**：向量+关键词混合检索，无结果直接拒绝
3. **答案生成层**：Prompt 强制约束只基于参考资料回答

## 数据库

### 主要表

- `documents` — 上传的文档
- `document_extractions` — AI自由提取的结果（JSONB存储，无固定字段）
- `knowledge_schemas` — AI自主构建的知识体系（版本化管理）
- `knowledge_chunks` — 知识块（文本+元数据+向量嵌入）
- `chat_sessions` / `chat_messages` — 对话记录

### 关键设计

- 所有AI产出的结构用 `JSONB` 存储，不预设固定列
- 知识体系版本化：每次新文档入库，重建整个知识体系（新版本）
- Embedding 存储为 JSONB 数组，检索时用应用层余弦相似度计算

## 包管理规范

仅使用 **pnpm**，禁止 npm/yarn。

## 开发命令

- `pnpm install` — 安装依赖
- `pnpm ts-check` — TypeScript 类型检查
- `pnpm lint` — ESLint 检查
- `pnpm build` — 构建生产版本

## API 接口清单

1. `GET /api/documents` — 获取文档列表
2. `POST /api/documents` — 上传文档（FormData）
3. `DELETE /api/documents/[id]` — 删除文档
4. `POST /api/documents/[id]/process` — 触发文档处理
5. `POST /api/chat` — 智能问答（SSE流式）
6. `GET /api/knowledge` — 查询知识库
7. `GET /api/knowledge?type=schema` — 查询知识体系
8. `GET /api/stats` — 获取统计数据
9. `GET /api/sessions` — 获取会话列表
10. `GET /api/sessions?session_id=xxx` — 获取会话消息
11. `DELETE /api/sessions?session_id=xxx` — 删除会话
