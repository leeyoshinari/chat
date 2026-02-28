/**
 * 侧边栏组件
 * 展示历史对话列表
 */
"use client";

import React, { memo, useState, useCallback } from "react";
import { Session } from "@/types";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { cn, formatDate } from "@/lib/utils";
import {
  MessageSquare,
  Plus,
  Search,
  MoreHorizontal,
  Pencil,
  Trash2,
  X,
} from "lucide-react";

/**
 * 获取当前语言
 */
function getLanguage(): "zh" | "en" {
  if (typeof window === "undefined") return "zh";
  const lang = navigator.language.toLowerCase();
  return lang.startsWith("zh") ? "zh" : "en";
}

/**
 * 多语言文本
 */
const i18n = {
  chatList: { zh: "对话列表", en: "Chats" },
  searchPlaceholder: { zh: "搜索对话...", en: "Search chats..." },
  today: { zh: "今天", en: "Today" },
  yesterday: { zh: "昨天", en: "Yesterday" },
  thisWeek: { zh: "本周", en: "This Week" },
  older: { zh: "更早", en: "Older" },
  noMatch: { zh: "未找到匹配的对话", en: "No matching chats found" },
  noChats: { zh: "暂无对话", en: "No chats yet" },
  renameTitle: { zh: "重命名对话", en: "Rename Chat" },
  renamePlaceholder: { zh: "输入新标题", en: "Enter new title" },
  cancel: { zh: "取消", en: "Cancel" },
  confirm: { zh: "确认", en: "Confirm" },
  rename: { zh: "重命名", en: "Rename" },
  delete: { zh: "删除", en: "Delete" },
};

/**
 * 侧边栏属性
 */
interface SidebarProps {
  /** 会话列表 */
  sessions: Session[];
  /** 当前会话 ID */
  currentSessionId: string | null;
  /** 切换会话 */
  onSelectSession: (sessionId: string) => void;
  /** 删除会话 */
  onDeleteSession: (sessionId: string) => void;
  /** 重命名会话 */
  onRenameSession: (sessionId: string, title: string) => void;
  /** 新建会话 */
  onNewSession: () => void;
  /** 关闭侧边栏（移动端） */
  onClose?: () => void;
}

/**
 * 会话分组
 */
interface SessionGroup {
  label: string;
  sessions: Session[];
}

/**
 * 按时间分组会话
 */
function groupSessionsByDate(sessions: Session[]): SessionGroup[] {
  const lang = getLanguage();
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterday = new Date(today.getTime() - 24 * 60 * 60 * 1000);
  const thisWeek = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);

  const groups: Record<string, Session[]> = {
    today: [],
    yesterday: [],
    thisWeek: [],
    older: [],
  };

  sessions.forEach((session) => {
    const sessionDate = new Date(session.updatedAt);
    if (sessionDate >= today) {
      groups.today.push(session);
    } else if (sessionDate >= yesterday) {
      groups.yesterday.push(session);
    } else if (sessionDate >= thisWeek) {
      groups.thisWeek.push(session);
    } else {
      groups.older.push(session);
    }
  });

  const result: SessionGroup[] = [];
  if (groups.today.length > 0) {
    result.push({ label: i18n.today[lang], sessions: groups.today });
  }
  if (groups.yesterday.length > 0) {
    result.push({ label: i18n.yesterday[lang], sessions: groups.yesterday });
  }
  if (groups.thisWeek.length > 0) {
    result.push({ label: i18n.thisWeek[lang], sessions: groups.thisWeek });
  }
  if (groups.older.length > 0) {
    result.push({ label: i18n.older[lang], sessions: groups.older });
  }

  return result;
}

/**
 * 侧边栏组件
 */
export const Sidebar = memo(function Sidebar({
  sessions,
  currentSessionId,
  onSelectSession,
  onDeleteSession,
  onRenameSession,
  onNewSession,
  onClose,
}: SidebarProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [renameDialog, setRenameDialog] = useState<{
    open: boolean;
    sessionId: string;
    title: string;
  }>({ open: false, sessionId: "", title: "" });

  // 过滤会话
  const filteredSessions = searchQuery
    ? sessions.filter((s) =>
        s.title.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : sessions;

  // 分组会话
  const groupedSessions = groupSessionsByDate(filteredSessions);

  // 处理重命名
  const handleRename = useCallback(() => {
    if (renameDialog.title.trim()) {
      onRenameSession(renameDialog.sessionId, renameDialog.title.trim());
    }
    setRenameDialog({ open: false, sessionId: "", title: "" });
  }, [renameDialog, onRenameSession]);

  return (
    <div className="flex flex-col h-full bg-sidebar">
      {/* 头部 */}
      <div className="flex items-center justify-between p-4 border-b border-sidebar-border">
        <h2 className="font-semibold">{i18n.chatList[getLanguage()]}</h2>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon-sm" onClick={onNewSession}>
            <Plus className="h-4 w-4" />
          </Button>
          {onClose && (
            <Button variant="ghost" size="icon-sm" onClick={onClose}>
              <X className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>

      {/* 搜索框 */}
      <div className="p-3 border-b border-sidebar-border">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={i18n.searchPlaceholder[getLanguage()]}
            className="pl-9 bg-sidebar"
          />
        </div>
      </div>

      {/* 会话列表 */}
      <ScrollArea className="flex-1">
        <div className="p-2">
          {groupedSessions.length > 0 ? (
            groupedSessions.map((group) => (
              <div key={group.label} className="mb-4">
                {/* 分组标题 */}
                <div className="px-3 py-2 text-xs font-medium text-muted-foreground">
                  {group.label}
                </div>

                {/* 会话项 */}
                <div className="space-y-1">
                  {group.sessions.map((session) => (
                    <SessionItem
                      key={session.id}
                      session={session}
                      isActive={session.id === currentSessionId}
                      onSelect={() => {
                        onSelectSession(session.id);
                        onClose?.();
                      }}
                      onDelete={() => onDeleteSession(session.id)}
                      onRename={() =>
                        setRenameDialog({
                          open: true,
                          sessionId: session.id,
                          title: session.title,
                        })
                      }
                    />
                  ))}
                </div>
              </div>
            ))
          ) : (
            <div className="py-8 text-center text-sm text-muted-foreground">
              {searchQuery ? i18n.noMatch[getLanguage()] : i18n.noChats[getLanguage()]}
            </div>
          )}
        </div>
      </ScrollArea>

      {/* 重命名对话框 */}
      <Dialog
        open={renameDialog.open}
        onOpenChange={(open) =>
          !open && setRenameDialog({ open: false, sessionId: "", title: "" })
        }
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{i18n.renameTitle[getLanguage()]}</DialogTitle>
          </DialogHeader>
          <Input
            value={renameDialog.title}
            onChange={(e) =>
              setRenameDialog((prev) => ({ ...prev, title: e.target.value }))
            }
            placeholder={i18n.renamePlaceholder[getLanguage()]}
            onKeyDown={(e) => e.key === "Enter" && handleRename()}
          />
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() =>
                setRenameDialog({ open: false, sessionId: "", title: "" })
              }
            >
              {i18n.cancel[getLanguage()]}
            </Button>
            <Button onClick={handleRename}>{i18n.confirm[getLanguage()]}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
});

/**
 * 会话项组件
 */
const SessionItem = memo(function SessionItem({
  session,
  isActive,
  onSelect,
  onDelete,
  onRename,
}: {
  session: Session;
  isActive: boolean;
  onSelect: () => void;
  onDelete: () => void;
  onRename: () => void;
}) {
  return (
    <div
      className={cn(
        "group flex items-center gap-2 p-3 rounded-lg cursor-pointer transition-colors",
        "hover:bg-sidebar-hover",
        isActive && "bg-sidebar-hover"
      )}
      onClick={onSelect}
    >
      <MessageSquare className="h-4 w-4 flex-shrink-0 text-muted-foreground" />
      <div className="flex-1 min-w-0 overflow-hidden">
        <div className="text-sm font-medium truncate max-w-[160px]" title={session.title}>
          {session.title}
        </div>
        <div className="text-xs text-muted-foreground">
          {formatDate(session.updatedAt)}
        </div>
      </div>

      {/* 操作菜单 */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="icon-sm"
            className="flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity"
            onClick={(e) => e.stopPropagation()}
          >
            <MoreHorizontal className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onClick={onRename}>
            <Pencil className="h-4 w-4 mr-2" />
            {i18n.rename[getLanguage()]}
          </DropdownMenuItem>
          <DropdownMenuItem
            className="text-destructive"
            onClick={onDelete}
          >
            <Trash2 className="h-4 w-4 mr-2" />
            {i18n.delete[getLanguage()]}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
});
