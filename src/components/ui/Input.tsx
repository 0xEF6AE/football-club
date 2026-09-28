import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { controlStyles } from "./Field";

type InputProps = React.ComponentPropsWithRef<"input"> & { invalid?: boolean };

export function Input({ className, invalid, ...props }: InputProps) {
  return <input className={cn(controlStyles, className)} aria-invalid={invalid || undefined} {...props} />;
}

type TextareaProps = React.ComponentPropsWithRef<"textarea"> & { invalid?: boolean };

export function Textarea({ className, invalid, ...props }: TextareaProps) {
  return (
    <textarea
      className={cn(controlStyles, "min-h-24 resize-y leading-relaxed", className)}
      aria-invalid={invalid || undefined}
      {...props}
    />
  );
}

type SelectProps = React.ComponentPropsWithRef<"select"> & { invalid?: boolean };

/** className은 바깥 래퍼(폭 지정용)에 붙는다. 화살표는 아이콘이라 다크 모드에서도 색이 맞는다. */
export function Select({ className, invalid, children, ...props }: SelectProps) {
  return (
    <span className={cn("relative block", className)}>
      <select className={cn(controlStyles, "appearance-none pr-9")} aria-invalid={invalid || undefined} {...props}>
        {children}
      </select>
      <ChevronDown
        aria-hidden
        className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-muted"
      />
    </span>
  );
}
