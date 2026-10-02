import { cn } from "@/lib/utils";

type FieldProps = {
  label: string;
  htmlFor?: string;
  hint?: string;
  error?: string;
  /** 필수 아닌 필드에 "선택" 표시 */
  optional?: boolean;
  className?: string;
  children: React.ReactNode;
};

/** 라벨 + 입력 + 도움말/오류 메시지. 오류가 있으면 aria-describedby로 연결된다. */
export function Field({ label, htmlFor, hint, error, optional, className, children }: FieldProps) {
  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <label htmlFor={htmlFor} className="flex items-baseline gap-1.5 text-sm font-medium">
        {label}
        {optional && <span className="text-xs font-normal text-muted">선택</span>}
      </label>
      {children}
      {error ? (
        <p id={htmlFor ? `${htmlFor}-error` : undefined} className="text-sm text-danger" role="alert">
          {error}
        </p>
      ) : hint ? (
        <p id={htmlFor ? `${htmlFor}-hint` : undefined} className="text-xs text-muted">
          {hint}
        </p>
      ) : null}
    </div>
  );
}

/**
 * 입력칸·선택칸 공통 모양. 높이 44px(min-h-11)로 md 버튼과 나란히 맞는다.
 * 올리면 테두리가 조금 진해지고, 포커스되면 잔디색 테두리 + 옅은 링.
 */
export const controlStyles =
  "w-full min-h-11 rounded-lg border border-line bg-surface px-3 py-2 text-base text-fg placeholder:text-muted/70 " +
  "outline-none transition-[border-color,box-shadow,background-color] duration-150 hover:border-muted/60 " +
  "focus-visible:border-pitch-ink focus-visible:ring-3 focus-visible:ring-pitch-ink/15 " +
  "disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:border-line " +
  "aria-invalid:border-danger aria-invalid:focus-visible:ring-danger/20";
