/**
 * Zustand 状态管理
 * 管理整个应用的状态
 */
import { create } from "zustand";
import { persist } from "zustand/middleware";
import { Message, Session, ModelConfig } from "@/types";
import { generateId, extractTitle } from "@/lib/utils";
import * as db from "@/lib/db";

/**
 * 聊天状态接口
 */
interface ChatStore {
  // ============================================
  // 状态
  // ============================================
  
  /** 当前会话 ID */
  currentSessionId: string | null;
  /** 会话列表 */
  sessions: Session[];
  /** 当前会话的消息 */
  messages: Message[];
  /** 是否正在加载 */
  isLoading: boolean;
  /** 当前选择的模型 ID */
  selectedModelId: string | null;
  /** 当前选择的提供商 ID */
  selectedProviderId: string | null;
  /** 是否启用推理模式 */
  reasoningEnabled: boolean;
  /** 启用的工具列表 */
  enabledTools: string[];
  /** 访问密码 */
  accessPassword: string | null;
  /** 是否已验证密码 */
  isAuthenticated: boolean;
  /** 侧边栏是否打开（移动端） */
  sidebarOpen: boolean;
  /** 当前角色 ID */
  currentRoleId: string | null;
  /** 当前角色的系统提示词（缓存） */
  currentRolePrompt: string | null;

  // ============================================
  // 会话操作
  // ============================================
  
  /** 创建新会话 */
  createSession: () => Promise<string>;
  /** 切换会话 */
  switchSession: (sessionId: string) => Promise<void>;
  /** 删除会话 */
  deleteSession: (sessionId: string) => Promise<void>;
  /** 重命名会话 */
  renameSession: (sessionId: string, title: string) => Promise<void>;
  /** 清空当前会话消息 */
  clearCurrentSession: () => Promise<void>;
  /** 加载所有会话 */
  loadSessions: () => Promise<void>;

  // ============================================
  // 消息操作
  // ============================================
  
  /** 添加消息 */
  addMessage: (message: Omit<Message, "id" | "createdAt">) => Promise<Message>;
  /** 更新消息 */
  updateMessage: (messageId: string, updates: Partial<Message>) => Promise<void>;
  /** 删除消息 */
  deleteMessage: (messageId: string) => Promise<void>;
  /** 重新生成消息（删除并重新生成） */
  regenerateMessage: (messageId: string) => Promise<void>;

  // ============================================
  // 模型和工具操作
  // ============================================
  
  /** 设置选中的模型 */
  setSelectedModel: (modelId: string, providerId: string) => void;
  /** 切换推理模式 */
  toggleReasoning: () => void;
  /** 设置启用的工具 */
  setEnabledTools: (tools: string[]) => void;
  /** 切换工具启用状态 */
  toggleTool: (toolId: string) => void;

  // ============================================
  // 认证操作
  // ============================================
  
  /** 设置访问密码 */
  setAccessPassword: (password: string) => void;
  /** 验证密码 */
  authenticate: (password: string) => boolean;
  /** 登出 */
  logout: () => void;

  // ============================================
  // UI 操作
  // ============================================
  
  /** 切换侧边栏 */
  toggleSidebar: () => void;
  /** 设置侧边栏状态 */
  setSidebarOpen: (open: boolean) => void;
  /** 设置加载状态 */
  setLoading: (loading: boolean) => void;
  /** 设置当前角色 */
  setCurrentRole: (roleId: string | null, systemPrompt?: string | null) => void;
}

/**
 * 创建聊天状态存储
 */
export const useChatStore = create<ChatStore>()(
  persist(
    (set, get) => ({
      // 初始状态
      currentSessionId: null,
      sessions: [],
      messages: [],
      isLoading: false,
      selectedModelId: null,
      selectedProviderId: null,
      reasoningEnabled: false,
      enabledTools: [],
      accessPassword: null,
      isAuthenticated: false,
      sidebarOpen: false,
      currentRoleId: null,
      currentRolePrompt: null,

      // ============================================
      // 会话操作实现
      // ============================================

      createSession: async () => {
        const { selectedModelId, currentRoleId, enabledTools, sessions, messages, currentSessionId } = get();
        
        // 防止重复创建空会话
        if (currentSessionId) {
          const currentSession = sessions.find((s) => s.id === currentSessionId);
          if (currentSession && messages.length === 0 && currentSession.title === "New Chat") {
            return currentSessionId;
          }
        }
        
        const id = generateId();
        const now = Date.now();
        
        const session: Session = {
          id,
          title: "New Chat",
          modelId: selectedModelId || "",
          roleId: currentRoleId || undefined,
          enabledTools: enabledTools.length > 0 ? enabledTools : undefined,
          createdAt: now,
          updatedAt: now,
        };

        await db.createSession(session);
        
        set((state) => ({
          sessions: [session, ...state.sessions],
          currentSessionId: id,
          messages: [],
          currentRoleId: null,
          currentRolePrompt: null,
        }));

        return id;
      },

      switchSession: async (sessionId) => {
        const messages = await db.getMessagesBySession(sessionId);
        const session = await db.getSession(sessionId);
        
        set({
          currentSessionId: sessionId,
          messages,
          selectedModelId: session?.modelId || get().selectedModelId,
          currentRoleId: session?.roleId || null,
          enabledTools: session?.enabledTools || [],
        });
      },

      deleteSession: async (sessionId) => {
        await db.deleteSession(sessionId);
        
        const { currentSessionId, sessions } = get();
        const newSessions = sessions.filter((s) => s.id !== sessionId);
        
        // 如果删除的是当前会话，切换到第一个会话或清空
        if (currentSessionId === sessionId) {
          if (newSessions.length > 0) {
            await get().switchSession(newSessions[0].id);
          } else {
            set({ currentSessionId: null, messages: [] });
          }
        }
        
        set({ sessions: newSessions });
      },

      renameSession: async (sessionId, title) => {
        const session = await db.getSession(sessionId);
        if (session) {
          session.title = title;
          session.updatedAt = Date.now();
          await db.updateSession(session);
          
          set((state) => ({
            sessions: state.sessions.map((s) =>
              s.id === sessionId ? { ...s, title, updatedAt: session.updatedAt } : s
            ),
          }));
        }
      },

      clearCurrentSession: async () => {
        const { currentSessionId, sessions } = get();
        if (currentSessionId) {
          // 删除当前会话
          await db.deleteSession(currentSessionId);
          const newSessions = sessions.filter((s) => s.id !== currentSessionId);
          set({ sessions: newSessions });
          
          // 创建新会话
          await get().createSession();
        }
      },

      loadSessions: async () => {
        const sessions = await db.getAllSessions();
        set({ sessions });
      },

      // ============================================
      // 消息操作实现
      // ============================================

      addMessage: async (messageData) => {
        let { currentSessionId } = get();
        
        // 如果没有当前会话，创建一个
        if (!currentSessionId) {
          currentSessionId = await get().createSession();
        }

        const message: Message = {
          ...messageData,
          id: generateId(),
          sessionId: currentSessionId!,
          createdAt: Date.now(),
        };

        await db.addMessage(message);

        // 检查是否是第一条用户消息（用于标记需要生成标题）
        const { messages, sessions } = get();
        const isFirstUserMessage = 
          messages.length === 0 &&
          message.role === "user" &&
          message.content[0]?.type === "text";

        set((state) => ({
          messages: [...state.messages, message],
          sessions: state.sessions.map((s) =>
            s.id === currentSessionId
              ? { ...s, updatedAt: Date.now() }
              : s
          ),
        }));

        // 返回消息对象，包含是否需要生成标题的标记
        return { ...message, needsTitle: isFirstUserMessage };
      },

      updateMessage: async (messageId, updates) => {
        const { messages } = get();
        const message = messages.find((m) => m.id === messageId);
        
        if (message) {
          const updatedMessage = { ...message, ...updates };
          await db.updateMessage(updatedMessage);
          
          set((state) => ({
            messages: state.messages.map((m) =>
              m.id === messageId ? updatedMessage : m
            ),
          }));
        }
      },

      deleteMessage: async (messageId) => {
        await db.deleteMessage(messageId);
        set((state) => ({
          messages: state.messages.filter((m) => m.id !== messageId),
        }));
      },

      regenerateMessage: async (messageId) => {
        // 找到要重新生成的消息及其之后的所有消息
        const { messages } = get();
        const index = messages.findIndex((m) => m.id === messageId);
        
        if (index !== -1) {
          // 删除该消息及之后的所有消息
          const toDelete = messages.slice(index);
          for (const msg of toDelete) {
            await db.deleteMessage(msg.id);
          }
          
          set((state) => ({
            messages: state.messages.slice(0, index),
          }));
        }
      },

      // ============================================
      // 模型和工具操作实现
      // ============================================

      setSelectedModel: (modelId, providerId) => {
        set({
          selectedModelId: modelId,
          selectedProviderId: providerId,
        });
      },

      toggleReasoning: () => {
        set((state) => ({ reasoningEnabled: !state.reasoningEnabled }));
      },

      setEnabledTools: (tools) => {
        set({ enabledTools: tools });
      },

      toggleTool: (toolId) => {
        set((state) => ({
          enabledTools: state.enabledTools.includes(toolId)
            ? state.enabledTools.filter((t) => t !== toolId)
            : [...state.enabledTools, toolId],
        }));
      },

      // ============================================
      // 认证操作实现
      // ============================================

      setAccessPassword: (password) => {
        set({ accessPassword: password, isAuthenticated: true });
      },

      authenticate: (_password) => {
        // 密码验证现在由服务端完成
        // 此方法仅用于标记已验证状态
        set({ isAuthenticated: true });
        return true;
      },

      logout: () => {
        set({ isAuthenticated: false, accessPassword: null });
      },

      // ============================================
      // UI 操作实现
      // ============================================

      toggleSidebar: () => {
        set((state) => ({ sidebarOpen: !state.sidebarOpen }));
      },

      setSidebarOpen: (open) => {
        set({ sidebarOpen: open });
      },

      setLoading: (loading) => {
        set({ isLoading: loading });
      },

      setCurrentRole: (roleId, systemPrompt) => {
        set({ currentRoleId: roleId, currentRolePrompt: systemPrompt || null });
      },
    }),
    {
      name: "ai-chat-storage",
      // 只持久化部分状态
      partialize: (state) => ({
        selectedModelId: state.selectedModelId,
        selectedProviderId: state.selectedProviderId,
        reasoningEnabled: state.reasoningEnabled,
        enabledTools: state.enabledTools,
        accessPassword: state.accessPassword,
        isAuthenticated: state.isAuthenticated,
      }),
    }
  )
);
