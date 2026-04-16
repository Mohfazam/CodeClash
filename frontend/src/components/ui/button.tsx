import { ButtonHTMLAttributes } from "react";

type Props = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "ghost" | "outline";
};

const variantMap: Record<NonNullable<Props["variant"]>, string> = {
  primary: "bg-primary text-white hover:bg-primary-soft",
  ghost: "bg-transparent hover:bg-surface-soft",
  outline: "border border-border bg-surface hover:border-primary-soft",
};

export function Button({ className = "", variant = "primary", ...props }: Props) {
  return (
    <button
      className={`rounded-lg px-4 py-2 text-sm font-medium transition disabled:cursor-not-allowed disabled:opacity-60 ${variantMap[variant]} ${className}`}
      {...props}
    />
  );
}
