/**
 * 密码验证对话框
 */
"use client";

import React, { memo, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Lock, Loader2 } from "lucide-react";

/**
 * 密码对话框属性
 */
interface PasswordDialogProps {
  /** 是否打开 */
  open: boolean;
  /** 验证密码回调（异步） */
  onSubmit: (password: string) => Promise<boolean>;
  /** 错误提示 */
  error?: string;
}

/**
 * 密码验证对话框
 */
export const PasswordDialog = memo(function PasswordDialog({
  open,
  onSubmit,
  error,
}: PasswordDialogProps) {
  const [password, setPassword] = useState("");
  const [localError, setLocalError] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!password) {
      setLocalError("请输入密码");
      return;
    }
    
    setIsLoading(true);
    setLocalError("");
    
    try {
      const success = await onSubmit(password);
      if (!success) {
        setLocalError("密码错误");
        setPassword("");
      }
    } catch (err) {
      setLocalError("验证失败，请重试");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={open}>
      <DialogContent className="sm:max-w-[400px]" hideCloseButton>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Lock className="h-5 w-5" />
            输入访问密码
          </DialogTitle>
          <DialogDescription>
            此应用需要密码才能访问，请输入正确的密码。
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Input
              type="password"
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
                setLocalError("");
              }}
              placeholder="请输入密码"
              autoFocus
              disabled={isLoading}
            />
            {(error || localError) && (
              <p className="text-sm text-destructive mt-2">
                {error || localError}
              </p>
            )}
          </div>

          <Button type="submit" className="w-full" disabled={isLoading}>
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                验证中...
              </>
            ) : (
              "确认"
            )}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
});
