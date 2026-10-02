import { LoaderCircle } from "lucide-react";
import { cn } from "@/lib/utils";

export type ButtonVariant = "primary" | "accent" | "secondary" | "ghost" | "danger" | "dangerSolid";
export type ButtonSize = "sm" | "md" | "lg" | "icon";

/**
 * 누르면 살짝 눌리고(active:scale), 채운 버튼은 윗면에 1px 빛을 줘 손에 잡히는 느낌을 낸다.
 * 높이: sm 36px(손가락으로 누를 최소), md 44px(입력칸과 같은 높이), lg 48px.
 */
const base =
  "inline-flex shrink-0 select-none items-center justify-center gap-1.5 whitespace-nowrap rounded-lg font-medium " +
  "transition-[color,background-color,border-color,box-shadow,scale] duration-150 active:scale-[0.97] " +
  "outline-none focus-visible:ring-2 focus-visible:ring-pitch-ink/40 focus-visible:ring-offset-2 focus-visible:ring-offset-bg " +
  "disabled:pointer-events-none disabled:opacity-50";

const variants: Record<ButtonVariant, string> = {
  /** 잔디색. 일반적인 확정 동작 */
  primary: "bg-pitch text-on-pitch shadow-[inset_0_1px_0_rgb(255_255_255/0.14)] hover:bg-pitch-deep",
  /** 전광판 amber. 화면당 하나, 가장 중요한 동작에만 */
  accent: "bg-amber text-amber-fg shadow-[inset_0_1px_0_rgb(255_255_255/0.3)] hover:brightness-[0.96]",
  secondary: "border border-line bg-surface text-fg hover:border-muted/60 hover:bg-surface-2/60",
  ghost: "text-fg hover:bg-surface-2",
  danger: "text-danger hover:bg-danger/10",
  dangerSolid: "bg-danger text-on-pitch shadow-[inset_0_1px_0_rgb(255_255_255/0.16)] hover:brightness-95",
};

const sizes: Record<ButtonSize, string> = {
  sm: "h-9 px-3 text-sm",
  md: "h-11 px-4 text-[15px]",
  lg: "h-12 px-5 text-base",
  icon: "size-10",
};

export function buttonStyles({
  variant = "primary",
  size = "md",
  className,
}: { variant?: ButtonVariant; size?: ButtonSize; className?: string } = {}) {
  return cn(base, variants[variant], sizes[size], className);
}

type ButtonProps = React.ComponentPropsWithRef<"button"> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
  /** 진행 중이면 스피너를 보여주고 비활성화한다. */
  pending?: boolean;
};

export function Button({
  variant,
  size,
  pending = false,
  className,
  children,
  disabled,
  type = "button",
  ...props
}: ButtonProps) {
  return (
    <button
      type={type}
      className={buttonStyles({ variant, size, className })}
      disabled={disabled || pending}
      aria-busy={pending || undefined}
      {...props}
    >
      {pending && <LoaderCircle className="size-4 animate-spin" aria-hidden />}
      {children}
    </button>
  );
}
