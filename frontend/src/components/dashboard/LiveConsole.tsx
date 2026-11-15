import { useEffect, useRef } from "react";
import type { StreamLog } from "../../hooks/useRunStream";
import { EmptyState } from "../ui/EmptyState";
import { Panel } from "../ui/Panel";

interface LiveConsoleProps {
  logs: StreamLog[];
  running: boolean;
}

export function LiveConsole({ logs, running }: LiveConsoleProps) {
  const consoleRef = useRef<HTMLDivElement | null>(null);
  const followOutput = useRef(true);

  useEffect(() => {
    const consoleElement = consoleRef.current;
    if (running && followOutput.current && consoleElement) {
      // Scroll only the log pane. scrollIntoView also moves the whole page.
      consoleElement.scrollTop = consoleElement.scrollHeight;
    }
  }, [logs, running]);

  return (
    <Panel
      title="Consola k6"
      bodyClassName="p-0"
      className="min-h-0"
      actions={
        <span className="font-mono text-[11px] text-sky/40">
          {logs.length} línea{logs.length === 1 ? "" : "s"}
        </span>
      }
    >
      <div
        ref={consoleRef}
        role="log"
        aria-label="Salida de k6"
        aria-live="off"
        onScroll={(event) => {
          const element = event.currentTarget;
          followOutput.current = element.scrollHeight - element.scrollTop - element.clientHeight < 32;
        }}
        className="h-56 overflow-y-auto overscroll-contain px-4 py-3 font-mono text-[11px] leading-relaxed scrollbar-slim"
      >
        {logs.length === 0 ? (
          <EmptyState
            icon="›_"
            title="Sin actividad todavía"
            description="Las salidas de k6 aparecerán aquí en tiempo real cuando inicies una prueba."
          />
        ) : (
          logs.map((entry) => (
            <p key={entry.id} className="whitespace-pre-wrap break-all text-mint/80">
              <span className="text-mint">›</span> {entry.line}
            </p>
          ))
        )}
      </div>
    </Panel>
  );
}
