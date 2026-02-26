/**
 * Button 组件
 * 基于 Radix UI 和 Tailwind CSS 的按钮组件
 */
import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

/**
 * 按钮样式变体
 */
const buttonVariants = cva(
  // 基础样式
  "inline-flex items-center justify-center whitespace-nowrap rounded-lg text-sm font-medium transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 active:scale-[0.98]",
  {
    variants: {
      /** 按钮变体 */
      variant: {
        // 主要按钮 - 蓝色背景
        default:
          "bg-primary text-primary-foreground shadow-sm hover:bg-primary/90",
        // 危险按钮 - 红色
        destructive:
          "bg-destructive text-destructive-foreground shadow-sm hover:bg-destructive/90",
        // 轮廓按钮
        outline:
          "border border-input bg-background hover:bg-accent hover:text-accent-foreground",
        // 次要按钮
        secondary:
          "bg-secondary text-secondary-foreground hover:bg-secondary/80",
        // 幽灵按钮 - 无背景
        ghost: "hover:bg-accent hover:text-accent-foreground",
        // 链接样式
        link: "text-primary underline-offset-4 hover:underline",
      },
      /** 按钮大小 */
      size: {
        default: "h-10 px-4 py-2",
        sm: "h-8 px-3 text-xs",
        lg: "h-12 px-8 text-base",
        icon: "h-10 w-10",
        "icon-sm": "h-8 w-8",
        "icon-lg": "h-12 w-12",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
);

/**
 * 按钮属性接口
 */
export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  /** 是否显示加载状态 */
  loading?: boolean;
}

/**
 * Button 组件
 */
const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, loading, children, disabled, ...props }, ref) => {
    return (
      <button
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        disabled={disabled || loading}
        {...props}
      >
        {loading && (
          <svg
            className="mr-2 h-4 w-4 animate-spin"
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
          >
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
            />
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
            />
          </svg>
        )}
        {children}
      </button>
    );
  }
);

Button.displayName = "Button";

export { Button, buttonVariants };
