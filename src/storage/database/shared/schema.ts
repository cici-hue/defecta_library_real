import { pgTable, serial, varchar, text, timestamp, jsonb, integer, index } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

// System table - must keep
export const healthCheck = pgTable("health_check", {
  id: serial().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true, mode: "string" }).defaultNow(),
});

// Uploaded documents
export const documents = pgTable(
  "documents",
  {
    id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
    filename: varchar("filename", { length: 500 }).notNull(),
    file_key: varchar("file_key", { length: 500 }).notNull(),
    file_type: varchar("file_type", { length: 50 }).notNull(),
    file_size: integer("file_size").notNull(),
    status: varchar("status", { length: 20 }).notNull().default("pending"),
    created_at: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updated_at: timestamp("updated_at", { withTimezone: true }),
  },
  (table) => [
    index("documents_status_idx").on(table.status),
    index("documents_created_at_idx").on(table.created_at),
  ]
);

// AI extraction results per document
export const documentExtractions = pgTable(
  "document_extractions",
  {
    id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
    document_id: varchar("document_id", { length: 36 })
      .notNull()
      .references(() => documents.id, { onDelete: "cascade" }),
    extraction_result: jsonb("extraction_result").notNull(),
    created_at: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("document_extractions_document_id_idx").on(table.document_id),
  ]
);

// AI-constructed knowledge structure
export const knowledgeSchemas = pgTable(
  "knowledge_schemas",
  {
    id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
    schema_description: text("schema_description").notNull(),
    schema_structure: jsonb("schema_structure").notNull(),
    version: integer("version").notNull().default(1),
    is_active: varchar("is_active", { length: 10 }).notNull().default("true"),
    created_at: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("knowledge_schemas_is_active_idx").on(table.is_active),
  ]
);

// Knowledge chunks with embeddings stored as JSONB
export const knowledgeChunks = pgTable(
  "knowledge_chunks",
  {
    id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
    chunk_text: text("chunk_text").notNull(),
    metadata: jsonb("metadata"),
    source_document_ids: jsonb("source_document_ids"),
    related_chunk_ids: jsonb("related_chunk_ids"),
    embedding: jsonb("embedding"),
    knowledge_schema_id: varchar("knowledge_schema_id", { length: 36 }).references(
      () => knowledgeSchemas.id
    ),
    created_at: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("knowledge_chunks_knowledge_schema_id_idx").on(table.knowledge_schema_id),
  ]
);

// Chat sessions
export const chatSessions = pgTable(
  "chat_sessions",
  {
    id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
    title: varchar("title", { length: 500 }),
    created_at: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updated_at: timestamp("updated_at", { withTimezone: true }),
  },
  (table) => [
    index("chat_sessions_created_at_idx").on(table.created_at),
  ]
);

// Chat messages
export const chatMessages = pgTable(
  "chat_messages",
  {
    id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
    session_id: varchar("session_id", { length: 36 })
      .notNull()
      .references(() => chatSessions.id, { onDelete: "cascade" }),
    role: varchar("role", { length: 20 }).notNull(),
    content: text("content").notNull(),
    sources: jsonb("sources"),
    intent_result: jsonb("intent_result"),
    created_at: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("chat_messages_session_id_idx").on(table.session_id),
    index("chat_messages_created_at_idx").on(table.created_at),
  ]
);

// Document images
export const documentImages = pgTable(
  "document_images",
  {
    id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
    document_id: varchar("document_id", { length: 36 })
      .notNull()
      .references(() => documents.id, { onDelete: "cascade" }),
    filename: varchar("filename", { length: 500 }).notNull(),
    file_key: varchar("file_key", { length: 500 }).notNull(),
    mime_type: varchar("mime_type", { length: 100 }),
    file_size: integer("file_size"),
    source_slide: integer("source_slide"),
    image_hash: text("image_hash"),
    created_at: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("document_images_document_id_idx").on(table.document_id),
    index("document_images_created_at_idx").on(table.created_at),
  ]
);

// Defect cases (缺陷案例)
export const defectCases = pgTable(
  "defect_cases",
  {
    id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
    document_id: varchar("document_id", { length: 36 })
      .notNull()
      .references(() => documents.id, { onDelete: "cascade" }),
    image_id: varchar("image_id", { length: 36 }).references(() => documentImages.id, { onDelete: "set null" }),
    source_slide: integer("source_slide"),
    
    // 案例基本信息
    materials: text("materials"),
    style: text("style"),
    claim_reason: text("claim_reason").notNull(),
    defect_description: text("defect_description"),
    position: text("position"),
    
    // RCA 报告（预留字段）
    rca_root_cause: text("rca_root_cause"),
    rca_prevention: text("rca_prevention"),
    rca_correction: text("rca_correction"),
    
    // Embedding
    embedding: jsonb("embedding"),
    
    // 元数据
    created_at: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updated_at: timestamp("updated_at", { withTimezone: true }),
  },
  (table) => [
    index("defect_cases_document_id_idx").on(table.document_id),
    index("defect_cases_image_id_idx").on(table.image_id),
    index("defect_cases_created_at_idx").on(table.created_at),
    index("defect_cases_materials_idx").on(table.materials),
    index("defect_cases_claim_reason_idx").on(table.claim_reason),
  ]
);

// Defect guidelines (缺陷管控指南)
export const defectGuidelines = pgTable(
  "defect_guidelines",
  {
    id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
    
    // 分类信息
    claim_reason: varchar("claim_reason", { length: 200 }).notNull(),
    materials: jsonb("materials"), // 适用材料列表
    
    // 核心内容
    root_causes: jsonb("root_causes"), // 常见原因
    prevention_measures: jsonb("prevention_measures"), // 预防措施
    process_controls: jsonb("process_controls"), // 生产流程控制点
    quality_checkpoints: jsonb("quality_checkpoints"), // 质检要点
    
    // 关联信息
    related_defect_types: jsonb("related_defect_types"), // 相关缺陷类型
    risk_level: varchar("risk_level", { length: 20 }), // 风险等级: high/medium/low
    
    // 来源
    source_document_id: varchar("source_document_id", { length: 36 }).references(() => documents.id, { onDelete: "set null" }),
    source_type: varchar("source_type", { length: 50 }).notNull().default("auto_generated"), // auto_generated / manual / external
    
    // 状态
    status: varchar("status", { length: 20 }).notNull().default("draft"), // draft / published / deprecated
    completeness: varchar("completeness", { length: 20 }).notNull().default("partial"), // partial / complete
    
    // 元数据
    created_at: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updated_at: timestamp("updated_at", { withTimezone: true }),
    
    // 版本控制
    version: integer("version").notNull().default(1),
    notes: text("notes"), // 补充说明
  },
  (table) => [
    index("defect_guidelines_claim_reason_idx").on(table.claim_reason),
    index("defect_guidelines_status_idx").on(table.status),
    index("defect_guidelines_risk_level_idx").on(table.risk_level),
  ]
);
