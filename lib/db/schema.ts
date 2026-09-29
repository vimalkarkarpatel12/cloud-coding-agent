import type { InferSelectModel } from "drizzle-orm";
import {
  bigserial,
  boolean,
  foreignKey,
  index,
  json,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";

export const user = pgTable("User", {
  createdAt: timestamp("createdAt").notNull().defaultNow(),
  email: varchar("email", { length: 64 }).notNull(),
  emailVerified: boolean("emailVerified").notNull().default(false),
  id: uuid("id").primaryKey().notNull().defaultRandom(),
  image: text("image"),
  isAnonymous: boolean("isAnonymous").notNull().default(false),
  name: text("name"),
  password: varchar("password", { length: 64 }),
  updatedAt: timestamp("updatedAt").notNull().defaultNow(),
});

export type User = InferSelectModel<typeof user>;

export const chat = pgTable("Chat", {
  createdAt: timestamp("createdAt").notNull(),
  id: uuid("id").primaryKey().notNull().defaultRandom(),
  title: text("title").notNull(),
  userId: uuid("userId")
    .notNull()
    .references(() => user.id),
  visibility: varchar("visibility", { enum: ["public", "private"] })
    .notNull()
    .default("private"),
});

export type Chat = InferSelectModel<typeof chat>;

export const message = pgTable("Message_v2", {
  attachments: json("attachments").notNull(),
  chatId: uuid("chatId")
    .notNull()
    .references(() => chat.id),
  createdAt: timestamp("createdAt").notNull(),
  id: uuid("id").primaryKey().notNull().defaultRandom(),
  parts: json("parts").notNull(),
  role: varchar("role").notNull(),
});

export type DBMessage = InferSelectModel<typeof message>;

export const vote = pgTable(
  "Vote_v2",
  {
    chatId: uuid("chatId")
      .notNull()
      .references(() => chat.id),
    isUpvoted: boolean("isUpvoted").notNull(),
    messageId: uuid("messageId")
      .notNull()
      .references(() => message.id),
  },
  (table) => ({
    pk: primaryKey({ columns: [table.chatId, table.messageId] }),
  })
);

export type Vote = InferSelectModel<typeof vote>;

export const document = pgTable(
  "Document",
  {
    content: text("content"),
    createdAt: timestamp("createdAt").notNull(),
    id: uuid("id").notNull().defaultRandom(),
    kind: varchar("text", { enum: ["text", "code", "image", "sheet"] })
      .notNull()
      .default("text"),
    title: text("title").notNull(),
    userId: uuid("userId")
      .notNull()
      .references(() => user.id),
  },
  (table) => ({
    pk: primaryKey({ columns: [table.id, table.createdAt] }),
  })
);

export type Document = InferSelectModel<typeof document>;

export const suggestion = pgTable(
  "Suggestion",
  {
    createdAt: timestamp("createdAt").notNull(),
    description: text("description"),
    documentCreatedAt: timestamp("documentCreatedAt").notNull(),
    documentId: uuid("documentId").notNull(),
    id: uuid("id").notNull().defaultRandom(),
    isResolved: boolean("isResolved").notNull().default(false),
    originalText: text("originalText").notNull(),
    suggestedText: text("suggestedText").notNull(),
    userId: uuid("userId")
      .notNull()
      .references(() => user.id),
  },
  (table) => ({
    documentRef: foreignKey({
      columns: [table.documentId, table.documentCreatedAt],
      foreignColumns: [document.id, document.createdAt],
    }),
    pk: primaryKey({ columns: [table.id] }),
  })
);

export type Suggestion = InferSelectModel<typeof suggestion>;

export const stream = pgTable(
  "Stream",
  {
    chatId: uuid("chatId").notNull(),
    createdAt: timestamp("createdAt").notNull(),
    id: uuid("id").notNull().defaultRandom(),
  },
  (table) => ({
    chatRef: foreignKey({
      columns: [table.chatId],
      foreignColumns: [chat.id],
    }),
    pk: primaryKey({ columns: [table.id] }),
  })
);

export type Stream = InferSelectModel<typeof stream>;

// OpenHands Integration Tables

export const agentSession = pgTable(
  "AgentSession",
  {
    id: uuid("id").primaryKey().notNull().defaultRandom(),
    userId: uuid("userId")
      .notNull()
      .references(() => user.id),
    taskDescription: text("taskDescription").notNull(),
    status: varchar("status")
      .notNull()
      .default("idle"),
    sandboxId: text("sandboxId"),
    openhands_session_id: text("openhands_session_id"),
    createdAt: timestamp("createdAt").notNull().defaultNow(),
    updatedAt: timestamp("updatedAt").notNull().defaultNow(),
  },
  (table) => ({
    userIdx: index("idx_agent_sessions_user").on(table.userId),
    statusIdx: index("idx_agent_sessions_status").on(table.status),
  })
);

export type AgentSession = InferSelectModel<typeof agentSession>;

export const agentAction = pgTable(
  "AgentAction",
  {
    id: bigserial("id", { mode: "bigint" }).primaryKey(),
    sessionId: uuid("sessionId")
      .notNull()
      .references(() => agentSession.id),
    actionType: varchar("actionType").notNull(),
    actionData: json("actionData").notNull(),
    createdAt: timestamp("createdAt").notNull().defaultNow(),
  },
  (table) => ({
    sessionIdx: index("idx_agent_actions_session").on(table.sessionId),
  })
);

export type AgentAction = InferSelectModel<typeof agentAction>;

export const userSecret = pgTable(
  "UserSecret",
  {
    id: uuid("id").primaryKey().notNull().defaultRandom(),
    userId: uuid("userId")
      .notNull()
      .references(() => user.id),
    secretName: varchar("secretName").notNull(),
    encryptedValue: text("encryptedValue").notNull(),
    createdAt: timestamp("createdAt").notNull().defaultNow(),
  },
  (table) => ({
    userIdx: index("idx_user_secrets_user").on(table.userId),
  })
);

export type UserSecret = InferSelectModel<typeof userSecret>;

export const githubApp = pgTable(
  "GitHubApp",
  {
    id: uuid("id").primaryKey().notNull().defaultRandom(),
    userId: uuid("userId")
      .notNull()
      .references(() => user.id),
    installationId: varchar("installationId").notNull(),
    appId: varchar("appId").notNull(),
    createdAt: timestamp("createdAt").notNull().defaultNow(),
  },
  (table) => ({
    userIdx: index("idx_github_apps_user").on(table.userId),
  })
);

export type GitHubApp = InferSelectModel<typeof githubApp>;

export const executionMetric = pgTable(
  "ExecutionMetric",
  {
    id: bigserial("id", { mode: "bigint" }).primaryKey(),
    sessionId: uuid("sessionId")
      .notNull()
      .references(() => agentSession.id),
    model: varchar("model").notNull(),
    durationSeconds: bigserial("durationSeconds", { mode: "bigint" }).notNull(),
    inputTokens: bigserial("inputTokens", { mode: "bigint" }),
    outputTokens: bigserial("outputTokens", { mode: "bigint" }),
    toolCalls: bigserial("toolCalls", { mode: "bigint" }),
    status: varchar("status"),
    createdAt: timestamp("createdAt").notNull().defaultNow(),
  },
  (table) => ({
    sessionIdx: index("idx_execution_metrics_session").on(table.sessionId),
    createdIdx: index("idx_execution_metrics_created").on(table.createdAt),
  })
);

export type ExecutionMetric = InferSelectModel<typeof executionMetric>;
