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
