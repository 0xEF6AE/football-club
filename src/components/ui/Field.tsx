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

export const controlStyles =
  "w-full rounded-md border border-line bg-surface px-3 py-2.5 text-base text-fg placeholder:text-muted/70 " +
  "outline-none transition-[border-color,box-shadow] focus-visible:border-pitch focus-visible:ring-2 focus-visible:ring-pitch/30 " +
  "disabled:cursor-not-allowed disabled:opacity-60 aria-invalid:border-danger aria-invalid:focus-visible:ring-danger/30";
