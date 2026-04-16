import { InputHTMLAttributes } from "react";

type Props = InputHTMLAttributes<HTMLInputElement>;

export function Input({ className = "", ...props }: Props) {
  return (
    <input
      className={`w-full rounded-lg border border-border bg-surface-soft px-3 py-2 text-sm text-foreground outline-none transition placeholder:text-muted focus:border-primary ${className}`}
      {...props}
    />
  );
}
