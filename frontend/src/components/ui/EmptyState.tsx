import type { ReactNode } from "react";

interface EmptyStateProps {
  title: string;
  description: string;
  action?: ReactNode;
  icon?: string;
}

export function EmptyState({ title, description, action, icon = "◇" }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 px-6 py-14 text-center">
      <span className="text-3xl text-cyan-glow/70" aria-hidden="true">
        {icon}
      </span>
      <div>
        <p className="text-sm font-semibold text-sky/85">{title}</p>
        <p className="mx-auto mt-1 max-w-sm text-xs leading-relaxed text-sky/45">{description}</p>
      </div>
      {action}
    </div>
  );
}
