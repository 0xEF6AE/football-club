import { cn } from "@/lib/utils";

type PageHeaderProps = {
  title: string;
  /** 제목 옆 보조 정보 (건수 등) */
  meta?: React.ReactNode;
  description?: string;
  /** 오른쪽 액션 (버튼/링크) */
  actions?: React.ReactNode;
  className?: string;
};

export function PageHeader({ title, meta, description, actions, className }: PageHeaderProps) {
  return (
    <header className={cn("flex flex-wrap items-end justify-between gap-x-4 gap-y-3 pb-5 pt-2", className)}>
      <div className="min-w-0">
        <h1 className="flex items-baseline gap-2 text-2xl font-semibold tracking-tight">
          {title}
          {meta && <span className="font-display text-base font-normal text-muted">{meta}</span>}
        </h1>
        {description && <p className="mt-1 text-sm text-muted">{description}</p>}
      </div>
      {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
    </header>
  );
}

/** 페이지 폭. 목록/폼은 narrow, 포메이션처럼 넓은 화면은 wide */
export function Container({
  size = "narrow",
  className,
  children,
}: {
  size?: "narrow" | "wide";
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={cn("mx-auto w-full", size === "narrow" ? "max-w-2xl" : "max-w-6xl", className)}>
      {children}
    </div>
  );
}
