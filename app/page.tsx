/**
 * 主页面组件
 * 聊天应用的入口页面
 */
"use client";

import React, { useEffect, useState, useCallback, useMemo, useRef } from "react";
import { useChatStore } from "@/store/chat-store";
import { Sidebar } from "@/components/chat/sidebar";
import { ChatHeader } from "@/components/chat/chat-header";
import { MessageList } from "@/components/chat/message-list";
import { ChatInput, SpeechMode, SpeechSelection } from "@/components/chat/chat-input";
import { PasswordDialog } from "@/components/chat/password-dialog";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { cn, generateId, getLanguage } from "@/lib/utils";
import type { Message, Role, ToolDefinition, ModelConfig } from "@/types";
import { toast } from "sonner";

/**
 * 更新 URL 中的 sessionId（不刷新页面）
 */
function updateUrlSessionId(sessionId: string | null) {
  if (typeof window === "undefined") return;
  const url = new URL(window.location.href);
  if (sessionId) {
    url.searchParams.set("session", sessionId);
  } else {
    url.searchParams.delete("session");
  }
  window.history.replaceState({}, "", url.toString());
}

/**
 * 从 URL 中读取 sessionId
 */
function getUrlSessionId(): string | null {
  if (typeof window === "undefined") return null;
  const url = new URL(window.location.href);
  return url.searchParams.get("session");
}

/**
 * 提供商分组
 */
interface ProviderGroup {
  id: string;
  name: string;
  icon: string;
  models: Array<ModelConfig & { providerId: string }>;
}

/**
 * 配置数据
 */
interface AppConfig {
  providers: ProviderGroup[];
  tools: ToolDefinition[];
  requirePassword: boolean;
  historyLimit: number;
  webSearchEnabled: boolean;
}

/**
 * 主页面
 */
export default function HomePage() {
  // 状态管理
  const {
    currentSessionId,
    sessions,
    messages,
    isLoading,
    selectedModelId,
    selectedProviderId,
    reasoningEnabled,
    enabledTools,
    isAuthenticated,
    sidebarOpen,
    loadSessions,
    ensureSession,
    switchSession,
    deleteSession,
    renameSession,
    clearCurrentSession,
    addMessage,
    updateMessage,
    deleteMessage,
    regenerateMessage,
    setSelectedModel,
    toggleReasoning,
    toggleTool,
    setLoading,
    setSidebarOpen,
    authenticate,
    setAccessPassword,
  } = useChatStore();

  // 本地状态
  const [config, setConfig] = useState<AppConfig | null>(null);
  const [roles, setRoles] = useState<Role[]>([]);
  const [streamingMessageId, setStreamingMessageId] = useState<string | null>(null);
  const [isMobile, setIsMobile] = useState(false);
  const [showPasswordDialog, setShowPasswordDialog] = useState(false);
  const [searchEnabled, setSearchEnabled] = useState(false);
  const [speechSelection, setSpeechSelection] = useState<SpeechSelection>({ asrEnabled: false, sttEnabled: false });
  
  // AbortController 用于停止响应
  const abortControllerRef = useRef<AbortController | null>(null);

  // 检测移动端
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };
    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, []);

  // 加载配置和会话
  useEffect(() => {
    async function init() {
      try {
        // 加载配置
        const configRes = await fetch("/api/config");
        const configData = await configRes.json();
        setConfig(configData);

        // 检查是否需要密码
        if (configData.requirePassword && !isAuthenticated) {
          // 尝试从 localStorage 获取已保存的密码并自动验证
          const savedPassword = localStorage.getItem("access_password");
          if (savedPassword) {
            // 调用 API 验证密码
            const verifyRes = await fetch("/api/config", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ password: savedPassword }),
            });
            if (verifyRes.ok) {
              authenticate(savedPassword);
              setAccessPassword(savedPassword);
            } else {
              // 密码失效，清除并显示对话框
              localStorage.removeItem("access_password");
              setShowPasswordDialog(true);
            }
          } else {
            setShowPasswordDialog(true);
          }
        }

        // 加载角色
        const rolesRes = await fetch("/api/roles");
        const rolesData = await rolesRes.json();
        setRoles(rolesData);

        // 加载会话
        await loadSessions();

        // 从 URL 恢复会话
        const urlSessionId = getUrlSessionId();
        if (urlSessionId) {
          const allSessions = useChatStore.getState().sessions;
          const targetSession = allSessions.find((s) => s.id === urlSessionId);
          if (targetSession) {
            await switchSession(urlSessionId);
          } else {
            // URL 中的 sessionId 不存在，清除后走正常初始化逻辑
            updateUrlSessionId(null);
            const activeId = await ensureSession();
            updateUrlSessionId(activeId);
          }
        } else {
          // 无 URL 参数：复用空会话或创建新会话
          const activeId = await ensureSession();
          updateUrlSessionId(activeId);
        }

        // 设置默认模型（只有当没有保存的模型时才设置）
        const persistedState = useChatStore.getState();
        if (!persistedState.selectedModelId && configData.providers.length > 0) {
          const firstProvider = configData.providers[0];
          if (firstProvider.models.length > 0) {
            const firstModel = firstProvider.models[0];
            setSelectedModel(firstModel.id, firstProvider.id);
          }
        }
      } catch (error) {
        console.error("Failed to initialize:", error);
        toast.error("加载配置失败");
      }
    }

    init();
  }, []);

  // 切换模型时重置推理和搜索状态
  const handleSelectModel = useCallback(
    (modelId: string, providerId: string) => {
      setSelectedModel(modelId, providerId);
      setSearchEnabled(false);
    },
    [setSelectedModel]
  );

  // 获取当前会话信息
  const currentSession = useMemo(() => {
    return sessions.find((s) => s.id === currentSessionId);
  }, [sessions, currentSessionId]);

  // 获取当前模型信息
  const currentModel = useMemo(() => {
    if (!config || !selectedModelId || !selectedProviderId) return null;
    const provider = config.providers.find((p) => p.id === selectedProviderId);
    return provider?.models.find((m) => m.id === selectedModelId);
  }, [config, selectedModelId, selectedProviderId]);

  // 获取当前提供商信息
  const currentProvider = useMemo(() => {
    if (!config || !selectedProviderId) return null;
    return config.providers.find((p) => p.id === selectedProviderId);
  }, [config, selectedProviderId]);

  // 处理密码验证
  const handlePasswordSubmit = useCallback(async (password: string) => {
    try {
      // 调用服务端验证密码
      const verifyRes = await fetch("/api/config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      
      if (verifyRes.ok) {
        setShowPasswordDialog(false);
        setAccessPassword(password);
        // 保存密码到 localStorage
        localStorage.setItem("access_password", password);
        return true;
      } else {
        return false;
      }
    } catch (error) {
      console.error("Password verification failed:", error);
      return false;
    }
  }, [setAccessPassword]);

  // 发送消息
  const handleSend = useCallback(
    async (content: string, attachments: any[], options?: { regenerate?: boolean }) => {
      if (!selectedModelId || !selectedProviderId) {
        toast.error("请先选择模型");
        return;
      }

      // 构建用户消息内容
      const userContent: any[] = [];
      if (content) {
        userContent.push({ type: "text", text: content });
      }
      for (const attachment of attachments) {
        userContent.push({
          type: attachment.type,
          url: attachment.url,
          fileName: attachment.name,
          mimeType: attachment.mimeType,
        });
      }

      // 添加用户消息
      let userMessage;
      if (!options?.regenerate) {
        userMessage = await addMessage({
          sessionId: currentSessionId || "",
          role: "user",
          content: userContent,
          model: selectedModelId,
        });
      } else {
        userMessage = messages[messages.length - 1];
      }

      // 如果是第一条消息，使用用户输入的前20个字作为标题
      if ((userMessage as any).needsTitle && content) {
        const title = content.length > 20 ? content.slice(0, 20) + "..." : content;
        renameSession(userMessage.sessionId, title);
        // 首条消息创建了新会话，将 sessionId 同步到 URL
        updateUrlSessionId(userMessage.sessionId);
      }

      // 添加 AI 响应消息占位
      const assistantMessage = await addMessage({
        sessionId: userMessage.sessionId,
        role: "assistant",
        content: [{ type: "text", text: "" }],
        model: selectedModelId,
      });

      const assistantMessageId = assistantMessage.id;

      setLoading(true);
      setStreamingMessageId(assistantMessageId);

      // 创建 AbortController
      const abortController = new AbortController();
      abortControllerRef.current = abortController;

      try {
        // 准备消息历史
        const historyLimit = config?.historyLimit || 50;
        const recentMessages = messages.slice(-historyLimit);

        // 构建请求消息
        const requestMessages: any[] = [];

        // 添加历史消息
        for (const msg of recentMessages) {
          requestMessages.push({
            role: msg.role,
            content: msg.content,
          });
        }

        // 添加当前用户消息
        requestMessages.push({
          role: "user",
          content: userContent,
        });

        // 发送请求
        const response = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            messages: requestMessages,
            model: selectedModelId,
            provider: selectedProviderId,
            stream: true,
            reasoning: reasoningEnabled,
            tools: enabledTools,
            search: searchEnabled,
            speechMode: speechSelection.asrEnabled && speechSelection.sttEnabled 
              ? "asr+stt" 
              : speechSelection.asrEnabled 
                ? "asr" 
                : speechSelection.sttEnabled 
                  ? "stt" 
                  : undefined,
            password: useChatStore.getState().accessPassword,
          }),
          signal: abortController.signal,
        });

        if (!response.ok) {
          if (response.status === 401) {
            setShowPasswordDialog(true);
            throw new Error("密码错误");
          }
          throw new Error(`请求失败: ${response.status}`);
        }

        // 处理流式响应
        const reader = response.body?.getReader();
        if (!reader) throw new Error("No response body");

        const decoder = new TextDecoder();
        let buffer = "";
        let fullContent = "";
        let thinking = "";
        let searchResults: any = null;
        let audioContent: any = null;
        let imageContent: any = null;

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() || "";

          for (const line of lines) {
            if (line.startsWith("data: ")) {
              const data = line.slice(6);
              try {
                const parsed = JSON.parse(data);

                if (parsed.type === "text") {
                  fullContent += parsed.content;
                  // 更新消息
                  await updateMessage(assistantMessageId, {
                    content: [{ type: "text", text: fullContent }],
                    thinking: thinking || undefined,
                    searchResults: searchResults || undefined,
                  });
                } else if (parsed.type === "thinking") {
                  thinking += parsed.content;
                  await updateMessage(assistantMessageId, {
                    thinking,
                    searchResults: searchResults || undefined,
                  });
                } else if (parsed.type === "audio") {
                  // TTS 音频：content 是 data URL，mimeType 已在适配器中处理
                  audioContent = {
                    type: "audio",
                    url: parsed.content,
                    mimeType: parsed.mimeType || "audio/wav",
                  };
                  await updateMessage(assistantMessageId, {
                    content: [audioContent],
                  });
                } else if (parsed.type === "image") {
                  // 图片生成
                  const imgUrl = parsed.imageUrl || parsed.content;
                  if (imgUrl) {
                    imageContent = { type: "image", url: imgUrl };
                    await updateMessage(assistantMessageId, {
                      content: [imageContent],
                    });
                  }
                } else if (parsed.type === "search_results") {
                  searchResults = parsed.data;
                  await updateMessage(assistantMessageId, {
                    searchResults,
                  });
                } else if (parsed.type === "error") {
                  toast.error(parsed.error || "发生错误");
                } else if (parsed.type === "done") {
                  break;
                }
              } catch {
                // 忽略解析错误
              }
            }
          }
        }

        // 完成流式输出 - 保留音频/图片内容，不覆盖
        const finalContent = audioContent
          ? [audioContent]
          : imageContent
            ? [imageContent]
            : [{ type: "text", text: fullContent }];

        await updateMessage(assistantMessageId, {
          content: finalContent,
          thinking: thinking || undefined,
          searchResults: searchResults || undefined,
          isStreaming: false,
        });
      } catch (error) {
        // 如果是用户主动取消，不显示错误
        if (error instanceof Error && error.name === 'AbortError') {
          // 保留已生成的内容
          return;
        }
        console.error("Chat error:", error);
        toast.error(error instanceof Error ? error.message : "发送失败");
        // 删除失败的消息
        await deleteMessage(assistantMessageId);
      } finally {
        setLoading(false);
        setStreamingMessageId(null);
        abortControllerRef.current = null;
      }
    },
    [
      currentSessionId,
      selectedModelId,
      selectedProviderId,
      messages,
      config,
      roles,
      renameSession,
      reasoningEnabled,
      enabledTools,
      searchEnabled,
      speechSelection,
      addMessage,
      updateMessage,
      deleteMessage,
      setLoading,
    ]
  );

  // 停止响应
  const handleStop = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
  }, []);

  // 切换联网搜索
  const handleToggleSearch = useCallback(() => {
    setSearchEnabled((prev) => !prev);
  }, []);

  // 切换 ASR 能力
  const handleToggleAsr = useCallback(() => {
    setSpeechSelection((prev) => ({ ...prev, asrEnabled: !prev.asrEnabled }));
  }, []);

  // 切换 STT 能力
  const handleToggleStt = useCallback(() => {
    setSpeechSelection((prev) => ({ ...prev, sttEnabled: !prev.sttEnabled }));
  }, []);

  // 重新生成消息
  const handleRegenerate = useCallback(
    async (messageId: string) => {
      // 找到要重新生成的消息
      const messageIndex = messages.findIndex((m) => m.id === messageId);
      if (messageIndex === -1) return;

      // 获取上一条用户消息
      let userMessage: Message | undefined;
      for (let i = messageIndex - 1; i >= 0; i--) {
        if (messages[i].role === "user") {
          userMessage = messages[i];
          break;
        }
      }

      if (!userMessage) return;

      // 删除当前消息
      await regenerateMessage(messageId);

      // 重新发送
      const textContent = userMessage.content
        .filter((c) => c.type === "text")
        .map((c) => c.text)
        .join("\n");

      const attachments = userMessage.content
        .filter((c) => c.type !== "text")
        .map((c) => ({
          id: generateId(),
          type: c.type as "image" | "file",
          name: c.fileName || "",
          url: c.url || "",
          mimeType: c.mimeType || "",
        }));

      handleSend(textContent, attachments, { regenerate: true });
    },
    [messages, regenerateMessage, handleSend]
  );

  // 包装 switchSession，同时更新 URL
  const handleSwitchSession = useCallback(async (sessionId: string) => {
    await switchSession(sessionId);
    updateUrlSessionId(sessionId);
  }, [switchSession]);

  // 包装 deleteSession，删除后同步 URL
  const handleDeleteSession = useCallback(async (sessionId: string) => {
    await deleteSession(sessionId);
    // 删除后，同步当前会话 ID 到 URL
    const newCurrentId = useChatStore.getState().currentSessionId;
    updateUrlSessionId(newCurrentId);
  }, [deleteSession]);

  // 处理新建对话：复用空会话或创建新会话
  const handleNewChat = useCallback(async () => {
    const activeId = await ensureSession();
    updateUrlSessionId(activeId);
    if (isMobile) {
      setSidebarOpen(false);
    }
  }, [ensureSession, isMobile, setSidebarOpen]);

  // 包装 clearCurrentSession，清除后同步 URL
  const handleClearCurrentSession = useCallback(async () => {
    await clearCurrentSession();
    const activeId = await ensureSession();
    updateUrlSessionId(activeId);
  }, [clearCurrentSession, ensureSession]);

  // 处理选择角色 - 返回 systemPrompt 给输入框填充
  const handleSelectRole = useCallback(
    (roleId: string): string | undefined => {
      const role = roles.find((r) => r.id === roleId);
      return role?.systemPrompt;
    },
    [roles]
  );

  // 如果需要密码且未验证，显示密码对话框
  if (showPasswordDialog) {
    return (
      <PasswordDialog
        open={true}
        onSubmit={handlePasswordSubmit}
      />
    );
  }

  // 加载中
  if (!config) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      {/* 桌面端侧边栏 */}
      {!isMobile && (
        <aside className="w-72 border-r flex-shrink-0">
          <Sidebar
            sessions={sessions}
            currentSessionId={currentSessionId}
            onSelectSession={handleSwitchSession}
            onDeleteSession={handleDeleteSession}
            onRenameSession={renameSession}
            onNewSession={handleNewChat}
          />
        </aside>
      )}

      {/* 移动端侧边栏抽屉 - 从底部弹出 */}
      {isMobile && (
        <Sheet open={sidebarOpen} onOpenChange={setSidebarOpen}>
          <SheetContent side="bottom" className="p-0 h-[80vh] rounded-t-xl">
            <Sidebar
              sessions={sessions}
              currentSessionId={currentSessionId}
              onSelectSession={handleSwitchSession}
              onDeleteSession={handleDeleteSession}
              onRenameSession={renameSession}
              onNewSession={handleNewChat}
              onClose={() => setSidebarOpen(false)}
            />
          </SheetContent>
        </Sheet>
      )}

      {/* 主内容区 */}
      <main className="flex-1 flex flex-col min-w-0">
        {/* 头部 */}
        <ChatHeader
          title={currentSession?.title || (getLanguage() === "zh" ? "新对话" : "New Chat")}
          modelName={currentModel?.name}
          providerIcon={currentProvider?.icon}
          toolNames={enabledTools.map(
            (id) => config.tools.find((t) => t.id === id)?.name || id
          )}
          messageCount={messages.length}
          onOpenSidebar={() => setSidebarOpen(true)}
          isMobile={isMobile}
          reasoningEnabled={reasoningEnabled}
          searchEnabled={searchEnabled}
          asrEnabled={speechSelection.asrEnabled}
          sttEnabled={speechSelection.sttEnabled}
        />

        {/* 消息列表 */}
        <MessageList
          messages={messages}
          onRegenerate={handleRegenerate}
          onDelete={deleteMessage}
          streamingMessageId={streamingMessageId}
          className="flex-1"
        />

        {/* 输入区域 */}
        <ChatInput
          onSend={handleSend}
          providers={config.providers}
          selectedModelId={selectedModelId}
          selectedProviderId={selectedProviderId}
          onSelectModel={handleSelectModel}
          tools={config.tools.filter((t) => t.id !== "web-search")}
          enabledTools={enabledTools}
          onToggleTool={toggleTool}
          reasoningEnabled={reasoningEnabled}
          onToggleReasoning={toggleReasoning}
          onClearHistory={handleClearCurrentSession}
          onNewChat={handleNewChat}
          roles={roles}
          onSelectRole={handleSelectRole}
          isLoading={isLoading}
          onStop={handleStop}
          searchEnabled={searchEnabled}
          onToggleSearch={currentModel?.capabilities?.search && config.webSearchEnabled ? handleToggleSearch : undefined}
          speechSelection={speechSelection}
          onToggleAsr={currentModel?.capabilities?.asr ? handleToggleAsr : undefined}
          onToggleStt={currentModel?.capabilities?.stt ? handleToggleStt : undefined}
        />
      </main>
    </div>
  );
}
