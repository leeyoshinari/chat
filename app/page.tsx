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
import { ChatInput } from "@/components/chat/chat-input";
import { PasswordDialog } from "@/components/chat/password-dialog";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { cn, generateId } from "@/lib/utils";
import type { Message, Role, ToolDefinition, ModelConfig } from "@/types";
import { toast } from "sonner";

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
    currentRoleId,
    loadSessions,
    createSession,
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
    setCurrentRole,
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

  // 获取当前角色
  const currentRole = useMemo(() => {
    return roles.find((r) => r.id === currentRoleId);
  }, [roles, currentRoleId]);

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
    async (content: string, attachments: any[]) => {
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
      const userMessage = await addMessage({
        sessionId: currentSessionId || "",
        role: "user",
        content: userContent,
        model: selectedModelId,
      });

      // 如果是第一条消息，使用用户输入的前15个字作为标题
      if ((userMessage as any).needsTitle && content) {
        const title = content.length > 15 ? content.slice(0, 15) + "..." : content;
        renameSession(userMessage.sessionId, title);
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

        // 获取当前角色的系统提示词（从最新状态获取）
        const activeRolePrompt = useChatStore.getState().currentRolePrompt;

        // 添加系统提示词
        if (activeRolePrompt) {
          requestMessages.push({
            role: "system",
            content: activeRolePrompt,
          });
        }

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
                  // TTS 音频：content 是 data URL
                  await updateMessage(assistantMessageId, {
                    content: [
                      {
                        type: "audio",
                        url: parsed.content,
                        mimeType: parsed.mimeType || "audio/mp3",
                      },
                    ],
                  });
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

        // 完成流式输出
        await updateMessage(assistantMessageId, {
          content: [{ type: "text", text: fullContent }],
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

      handleSend(textContent, attachments);
    },
    [messages, regenerateMessage, handleSend]
  );

  // 处理新建对话
  const handleNewChat = useCallback(async () => {
    await createSession();
    if (isMobile) {
      setSidebarOpen(false);
    }
  }, [createSession, isMobile, setSidebarOpen]);

  // 处理选择角色
  const handleSelectRole = useCallback(
    (roleId: string) => {
      const role = roles.find((r) => r.id === roleId);
      if (role) {
        setCurrentRole(roleId, role.systemPrompt);
        toast.success(`已切换到角色: ${role.name}`);
      }
    },
    [roles, setCurrentRole]
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
            onSelectSession={switchSession}
            onDeleteSession={deleteSession}
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
              onSelectSession={switchSession}
              onDeleteSession={deleteSession}
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
          title={currentSession?.title || "新对话"}
          modelName={currentModel?.name}
          roleName={currentRole?.name}
          providerIcon={currentProvider?.icon}
          toolNames={enabledTools.map(
            (id) => config.tools.find((t) => t.id === id)?.name || id
          )}
          messageCount={messages.length}
          onOpenSidebar={() => setSidebarOpen(true)}
          isMobile={isMobile}
          reasoningEnabled={reasoningEnabled}
          searchEnabled={searchEnabled}
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
          onClearHistory={clearCurrentSession}
          onNewChat={handleNewChat}
          roles={roles}
          onSelectRole={handleSelectRole}
          isLoading={isLoading}
          onStop={handleStop}
          searchEnabled={searchEnabled}
          onToggleSearch={currentModel?.capabilities?.search && config.webSearchEnabled ? handleToggleSearch : undefined}
        />
      </main>
    </div>
  );
}
