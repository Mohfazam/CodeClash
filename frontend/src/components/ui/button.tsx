import { ButtonHTMLAttributes } from "react";

type Props = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "ghost" | "outline";
  size?: "sm" | "md" | "lg";
};

const variantMap: Record<NonNullable<Props["variant"]>, string> = {
  primary: "bg-primary text-white hover:bg-primary-soft",
  ghost: "bg-transparent hover:bg-surface-soft",
  outline: "border border-border bg-surface hover:border-primary-soft",
};

const sizeMap: Record<NonNullable<Props["size"]>, string> = {
  sm: "px-3 py-1 text-xs",
  md: "px-4 py-2 text-sm",
  lg: "px-6 py-3 text-base",
};

export function Button({ className = "", variant = "primary", size = "md", ...props }: Props) {
  return (
    <button
      className={`rounded-lg font-medium transition disabled:cursor-not-allowed disabled:opacity-60 ${variantMap[variant]} ${sizeMap[size]} ${className}`}
      {...props}
    />
  );
}
