/**
 * IndexedDB 数据库存储层
 * 用于在浏览器本地存储对话数据
 */
import { openDB, DBSchema, IDBPDatabase } from "idb";
import { Message, Session } from "@/types";

/**
 * 数据库 Schema 定义
 */
interface ChatDBSchema extends DBSchema {
  /** 会话存储 */
  sessions: {
    key: string;
    value: Session;
    indexes: {
      "by-updated": number;
    };
  };
  /** 消息存储 */
  messages: {
    key: string;
    value: Message;
    indexes: {
      "by-session": string;
      "by-created": number;
    };
  };
  /** 设置存储 */
  settings: {
    key: string;
    value: { key: string; value: unknown };
  };
}

/** 数据库名称 */
const DB_NAME = "ai-chat-db";
/** 数据库版本 */
const DB_VERSION = 1;

/** 数据库实例 */
let dbInstance: IDBPDatabase<ChatDBSchema> | null = null;

/**
 * 获取数据库实例
 * 单例模式，确保只创建一个数据库连接
 */
async function getDB(): Promise<IDBPDatabase<ChatDBSchema>> {
  if (dbInstance) return dbInstance;

  dbInstance = await openDB<ChatDBSchema>(DB_NAME, DB_VERSION, {
    upgrade(db) {
      // 创建会话存储
      if (!db.objectStoreNames.contains("sessions")) {
        const sessionStore = db.createObjectStore("sessions", {
          keyPath: "id",
        });
        sessionStore.createIndex("by-updated", "updatedAt");
      }

      // 创建消息存储
      if (!db.objectStoreNames.contains("messages")) {
        const messageStore = db.createObjectStore("messages", {
          keyPath: "id",
        });
        messageStore.createIndex("by-session", "sessionId");
        messageStore.createIndex("by-created", "createdAt");
      }

      // 创建设置存储
      if (!db.objectStoreNames.contains("settings")) {
        db.createObjectStore("settings", { keyPath: "key" });
      }
    },
  });

  return dbInstance;
}

// ============================================
// 会话相关操作
// ============================================

/**
 * 创建新会话
 */
export async function createSession(session: Session): Promise<void> {
  const db = await getDB();
  await db.put("sessions", session);
}

/**
 * 获取所有会话
 * 按更新时间倒序排列
 */
export async function getAllSessions(): Promise<Session[]> {
  const db = await getDB();
  const sessions = await db.getAllFromIndex("sessions", "by-updated");
  return sessions.reverse();
}

/**
 * 获取单个会话
 */
export async function getSession(id: string): Promise<Session | undefined> {
  const db = await getDB();
  return db.get("sessions", id);
}

/**
 * 更新会话
 */
export async function updateSession(session: Session): Promise<void> {
  const db = await getDB();
  await db.put("sessions", session);
}

/**
 * 删除会话
 * 同时删除该会话下的所有消息
 */
export async function deleteSession(id: string): Promise<void> {
  const db = await getDB();
  
  // 删除会话下的所有消息
  const messages = await getMessagesBySession(id);
  const tx = db.transaction(["sessions", "messages"], "readwrite");
  
  await Promise.all([
    tx.objectStore("sessions").delete(id),
    ...messages.map((m) => tx.objectStore("messages").delete(m.id)),
  ]);
  
  await tx.done;
}

// ============================================
// 消息相关操作
// ============================================

/**
 * 添加消息
 */
export async function addMessage(message: Message): Promise<void> {
  const db = await getDB();
  await db.put("messages", message);
  
  // 更新会话的更新时间
  const session = await getSession(message.sessionId);
  if (session) {
    session.updatedAt = Date.now();
    await updateSession(session);
  }
}

/**
 * 获取会话下的所有消息
 * 按创建时间排序
 */
export async function getMessagesBySession(sessionId: string): Promise<Message[]> {
  const db = await getDB();
  const messages = await db.getAllFromIndex("messages", "by-session", sessionId);
  return messages.sort((a, b) => a.createdAt - b.createdAt);
}

/**
 * 更新消息
 */
export async function updateMessage(message: Message): Promise<void> {
  const db = await getDB();
  await db.put("messages", message);
}

/**
 * 删除消息
 */
export async function deleteMessage(id: string): Promise<void> {
  const db = await getDB();
  await db.delete("messages", id);
}

/**
 * 删除会话下的所有消息
 */
export async function clearSessionMessages(sessionId: string): Promise<void> {
  const db = await getDB();
  const messages = await getMessagesBySession(sessionId);
  const tx = db.transaction("messages", "readwrite");
  
  await Promise.all(messages.map((m) => tx.store.delete(m.id)));
  await tx.done;
}

/**
 * 获取会话的消息数量
 */
export async function getMessageCount(sessionId: string): Promise<number> {
  const messages = await getMessagesBySession(sessionId);
  return messages.length;
}

// ============================================
// 设置相关操作
// ============================================

/**
 * 保存设置
 */
export async function saveSetting(key: string, value: unknown): Promise<void> {
  const db = await getDB();
  await db.put("settings", { key, value });
}

/**
 * 获取设置
 */
export async function getSetting<T>(key: string): Promise<T | undefined> {
  const db = await getDB();
  const result = await db.get("settings", key);
  return result?.value as T | undefined;
}

/**
 * 删除设置
 */
export async function deleteSetting(key: string): Promise<void> {
  const db = await getDB();
  await db.delete("settings", key);
}

// ============================================
// 工具函数
// ============================================

/**
 * 清空所有数据
 * 用于重置应用
 */
export async function clearAllData(): Promise<void> {
  const db = await getDB();
  const tx = db.transaction(["sessions", "messages", "settings"], "readwrite");
  
  await Promise.all([
    tx.objectStore("sessions").clear(),
    tx.objectStore("messages").clear(),
    tx.objectStore("settings").clear(),
  ]);
  
  await tx.done;
}

/**
 * 导出所有数据
 * 用于备份
 */
export async function exportData(): Promise<{
  sessions: Session[];
  messages: Message[];
}> {
  const db = await getDB();
  const [sessions, messages] = await Promise.all([
    db.getAll("sessions"),
    db.getAll("messages"),
  ]);
  
  return { sessions, messages };
}

/**
 * 导入数据
 * 用于恢复备份
 */
export async function importData(data: {
  sessions: Session[];
  messages: Message[];
}): Promise<void> {
  const db = await getDB();
  const tx = db.transaction(["sessions", "messages"], "readwrite");
  
  await Promise.all([
    ...data.sessions.map((s) => tx.objectStore("sessions").put(s)),
    ...data.messages.map((m) => tx.objectStore("messages").put(m)),
  ]);
  
  await tx.done;
}
