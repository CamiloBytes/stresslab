import type { ButtonHTMLAttributes, ReactNode } from "react";
import { Spinner } from "./Spinner";

type ButtonVariant = "primary" | "danger" | "ghost" | "quiet";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  loading?: boolean;
  children: ReactNode;
}

const VARIANTS: Record<ButtonVariant, string> = {
  primary:
    "border border-cyan-glow/45 bg-cyan-glow/15 text-cyan-glow hover:bg-cyan-glow/25 hover:shadow-[0_0_24px_rgba(0,237,255,0.35)]",
  danger:
    "border border-rose/45 bg-rose/12 text-rose hover:bg-rose/25 hover:shadow-[0_0_24px_rgba(255,59,174,0.3)]",
  ghost: "border border-line text-sky/70 hover:border-sky/45 hover:text-sky",
  quiet: "text-sky/55 hover:text-sky",
};

export function Button({
  variant = "ghost",
  loading = false,
  className = "",
  disabled,
  children,
  type = "button",
  ...rest
}: ButtonProps) {
  return (
    <button
      {...rest}
      type={type}
      disabled={disabled || loading}
      className={`inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-all duration-200 focus-visible:ring-2 focus-visible:ring-cyan-glow/60 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-45 ${VARIANTS[variant]} ${className}`}
    >
      {loading ? <Spinner size={14} /> : null}
      {children}
    </button>
  );
}
