import type { ReactNode } from "react";

interface PanelProps {
  title?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
  bodyClassName?: string;
}

export function Panel({ title, actions, children, className = "", bodyClassName = "" }: PanelProps) {
  const hasHeader = title !== undefined || actions !== undefined;

  return (
    <section className={`glass overflow-hidden rounded-2xl ${className}`}>
      {hasHeader ? (
        <header className="flex items-center justify-between gap-3 border-b border-line px-5 py-3.5">
          <div className="min-w-0">
            {typeof title === "string" ? (
              <h2 className="truncate text-sm font-semibold tracking-wide text-sky/85">{title}</h2>
            ) : (
              title
            )}
          </div>
          {actions ? <div className="flex shrink-0 items-center gap-2">{actions}</div> : null}
        </header>
      ) : null}
      <div className={`p-5 ${bodyClassName}`}>{children}</div>
    </section>
  );
}
