import { useEffect, type ReactNode } from "react";
import { Button } from "./Button";

interface ModalProps {
  open: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
  wide?: boolean;
}

export function Modal({ open, title, onClose, children, footer, wide = false }: ModalProps) {
  useEffect(() => {
    if (!open) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-40 flex items-start justify-center overflow-y-auto bg-void/75 p-4 backdrop-blur-sm sm:p-8"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={`glass animate-rise my-auto w-full ${wide ? "max-w-3xl" : "max-w-lg"} rounded-2xl`}
      >
        <header className="flex items-center justify-between gap-3 border-b border-line px-5 py-4">
          <h2 className="text-base font-semibold text-sky/90">{title}</h2>
          <Button variant="quiet" onClick={onClose} aria-label="Cerrar">
            ✕
          </Button>
        </header>
        <div className="max-h-[75vh] overflow-y-auto px-5 py-5 scrollbar-slim">{children}</div>
        {footer ? (
          <footer className="flex items-center justify-end gap-3 border-t border-line px-5 py-4">{footer}</footer>
        ) : null}
      </div>
    </div>
  );
}
