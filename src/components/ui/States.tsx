import { CircleAlert } from "lucide-react";
import { Button } from "./Button";
import { cn } from "@/lib/utils";

type EmptyStateProps = {
  icon?: React.ReactNode;
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
};

/** 빈 화면은 다음 행동으로 안내한다. */
export function EmptyState({ icon, title, description, action, className }: EmptyStateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center gap-3 rounded-xl border border-dashed border-line px-6 py-12 text-center",
        className,
      )}
    >
      {icon && <div className="text-muted [&>svg]:size-8">{icon}</div>}
      <div className="flex flex-col gap-1">
        <p className="font-semibold">{title}</p>
        {description && <p className="max-w-xs text-sm text-muted">{description}</p>}
      </div>
      {action && <div className="mt-1">{action}</div>}
    </div>
  );
}

type ErrorStateProps = {
  message: string;
  onRetry?: () => void;
  retrying?: boolean;
  className?: string;
};

export function ErrorState({ message, onRetry, retrying, className }: ErrorStateProps) {
  return (
    <div
      role="alert"
      className={cn(
        "flex flex-col items-center gap-3 rounded-xl border border-danger/40 bg-danger/5 px-6 py-8 text-center",
        className,
      )}
    >
      <CircleAlert className="size-6 text-danger" aria-hidden />
      <p className="text-sm">{message}</p>
      {onRetry && (
        <Button variant="secondary" size="sm" onClick={onRetry} pending={retrying}>
          다시 불러오기
        </Button>
      )}
    </div>
  );
}

/** 폼 하단 등에 쓰는 한 줄 오류 */
export function InlineError({ children, className }: { children: React.ReactNode; className?: string }) {
  if (!children) return null;
  return (
    <p role="alert" className={cn("flex items-start gap-1.5 text-sm text-danger", className)}>
      <CircleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
      <span>{children}</span>
    </p>
  );
}
