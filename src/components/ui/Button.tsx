import { LoaderCircle } from "lucide-react";
import { cn } from "@/lib/utils";

export type ButtonVariant = "primary" | "accent" | "secondary" | "ghost" | "danger" | "dangerSolid";
export type ButtonSize = "sm" | "md" | "lg" | "icon";

const base =
  "inline-flex shrink-0 items-center justify-center gap-1.5 whitespace-nowrap rounded-md font-medium transition-colors " +
  "outline-none focus-visible:ring-2 focus-visible:ring-pitch/40 focus-visible:ring-offset-2 focus-visible:ring-offset-bg " +
  "disabled:pointer-events-none disabled:opacity-50";

const variants: Record<ButtonVariant, string> = {
  /** 잔디색. 일반적인 확정 동작 */
  primary: "bg-pitch text-on-pitch hover:bg-pitch-deep",
  /** 전광판 amber. 화면당 하나, 가장 중요한 동작에만 */
  accent: "bg-amber text-amber-fg hover:brightness-95",
  secondary: "border border-line bg-surface text-fg hover:border-muted",
  ghost: "text-fg hover:bg-surface-2",
  danger: "text-danger hover:bg-danger/10",
  dangerSolid: "bg-danger text-on-pitch hover:brightness-95",
};

const sizes: Record<ButtonSize, string> = {
  sm: "h-8 px-3 text-sm",
  md: "h-10 px-4 text-[15px]",
  lg: "h-12 px-5 text-base",
  icon: "size-9",
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
