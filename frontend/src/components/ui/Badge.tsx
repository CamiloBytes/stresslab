import type { ReactNode } from "react";

export type BadgeTone = "info" | "success" | "danger" | "warning" | "neutral";

interface BadgeProps {
  tone?: BadgeTone;
  pulse?: boolean;
  children: ReactNode;
  className?: string;
  title?: string;
}

const TONES: Record<BadgeTone, { dot: string; text: string; border: string }> = {
  info: { dot: "bg-cyan-glow", text: "text-cyan-glow", border: "border-cyan-glow/35" },
  success: { dot: "bg-mint", text: "text-mint", border: "border-mint/35" },
  danger: { dot: "bg-rose", text: "text-rose", border: "border-rose/40" },
  warning: { dot: "bg-amber", text: "text-amber", border: "border-amber/40" },
  neutral: { dot: "bg-sky/50", text: "text-sky/65", border: "border-line" },
};

export function Badge({ tone = "neutral", pulse = false, children, className = "", title }: BadgeProps) {
  const styles = TONES[tone];

  return (
    <span
      title={title}
      className={`inline-flex items-center gap-2 rounded-full border px-2.5 py-1 text-xs font-medium ${styles.border} ${styles.text} ${className}`}
    >
      <span
        className={`h-1.5 w-1.5 rounded-full ${styles.dot} ${pulse ? "animate-pulse-dot" : ""}`}
        aria-hidden="true"
      />
      {children}
    </span>
  );
}
