import type { ReactNode } from "react";
import type { Health, Run } from "../../lib/types";
import { statusLabel } from "../../lib/format";
import { Badge } from "../ui/Badge";

export type View = "dashboard" | "scenarios" | "history" | "security";

interface NavItem {
  view: View;
  label: string;
  icon: ReactNode;
}

const NAV_ITEMS: NavItem[] = [
  {
    view: "dashboard",
    label: "Tablero",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" className="h-4 w-4" aria-hidden="true">
        <rect x="3" y="3" width="7.5" height="7.5" rx="1.5" />
        <rect x="13.5" y="3" width="7.5" height="7.5" rx="1.5" />
        <rect x="3" y="13.5" width="7.5" height="7.5" rx="1.5" />
        <rect x="13.5" y="13.5" width="7.5" height="7.5" rx="1.5" />
      </svg>
    ),
  },
  {
    view: "security",
    label: "Seguridad",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" className="h-4 w-4" aria-hidden="true">
        <path d="M12 3.5 5 6.2v5.1c0 4.2 2.9 7.4 7 9.2 4.1-1.8 7-5 7-9.2V6.2L12 3.5Z" strokeLinejoin="round" />
        <path d="m9 12 2 2 4-4" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
  },
  {
    view: "scenarios",
    label: "Escenarios",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" className="h-4 w-4" aria-hidden="true">
        <path d="M4 19V9m5.5 10V5m5.5 14v-7m5 7V8" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    view: "history",
    label: "Historial",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" className="h-4 w-4" aria-hidden="true">
        <circle cx="12" cy="12" r="8.5" />
        <path d="M12 7.5V12l3 2" strokeLinecap="round" />
      </svg>
    ),
  },
];

interface AppShellProps {
  view: View;
  onNavigate: (view: View) => void;
  health: Health | null;
  connected: boolean;
  activeRun: Run | null;
  children: ReactNode;
}

function StatusBlock({ health, connected, activeRun }: Omit<AppShellProps, "view" | "onNavigate" | "children">) {
  const k6Tone = health?.k6.available ? "success" : "danger";
  const apiTone = health ? "success" : "danger";
  const running = activeRun?.status === "running";

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Badge tone={apiTone} pulse={!health}>
        API {health ? "en línea" : "desconectada"}
      </Badge>
      <Badge tone={k6Tone} title={health?.k6.version ?? undefined}>
        k6 {health?.k6.available ? (health.k6.mode === "docker" ? "docker" : "local") : "no disponible"}
      </Badge>
      <Badge tone="neutral">DB {health?.database ?? "—"}</Badge>
      {running ? (
        <Badge tone="info" pulse>
          {statusLabel("running")}
        </Badge>
      ) : connected ? (
        <Badge tone="success">SSE</Badge>
      ) : (
        <Badge tone="warning">SSE caído</Badge>
      )}
    </div>
  );
}

export function AppShell({ view, onNavigate, health, connected, activeRun, children }: AppShellProps) {
  return (
    <div className="flex min-h-full min-w-0 flex-col lg:flex-row">
      <aside className="glass z-30 flex shrink-0 flex-col gap-6 border-b border-line px-5 py-4 lg:sticky lg:top-0 lg:h-screen lg:w-56 lg:shrink-0 lg:border-r lg:border-b-0 lg:px-4 lg:py-6">
        <div className="flex items-center gap-3">
          <span className="relative flex h-9 w-9 items-center justify-center rounded-lg border border-cyan-glow/40 bg-cyan-glow/10 font-mono text-sm font-bold text-cyan-glow glow-cyan">
            S
            <span className="absolute -right-0.5 -top-0.5 h-2 w-2 animate-pulse-dot rounded-full bg-mint" />
          </span>
          <div className="min-w-0">
            <p className="text-sm font-bold tracking-[0.2em] text-sky/90">STRESSLAB</p>
            <p className="text-xs text-sky/65">Rendimiento y seguridad</p>
          </div>
        </div>

        <nav aria-label="Principal" className="grid grid-cols-4 gap-1 border-t border-line pt-3 lg:grid-cols-1 lg:gap-2">
          {NAV_ITEMS.map((item) => {
            const active = item.view === view;
            return (
              <button
                key={item.view}
                type="button"
                onClick={() => onNavigate(item.view)}
                aria-current={active ? "page" : undefined}
                className={`flex flex-col items-center justify-center gap-1 rounded-lg px-1 py-2 text-xs transition-colors focus-visible:ring-2 focus-visible:ring-cyan-glow/60 focus-visible:outline-none lg:flex-row lg:justify-start lg:gap-3 lg:px-3 lg:py-3 lg:text-sm ${
                  active
                    ? "border border-cyan-glow/35 bg-cyan-glow/10 text-cyan-glow"
                    : "border border-transparent text-sky/55 hover:bg-sky/5 hover:text-sky/90"
                }`}
              >
                {item.icon}
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>

        <div className="mt-auto hidden lg:block">
          <StatusBlock health={health} connected={connected} activeRun={activeRun} />
          {health?.k6.available && health.k6.version ? (
            <p className="mt-3 truncate font-mono text-[10px] text-sky/35" title={health.k6.version}>
              {health.k6.version}
            </p>
          ) : (
            <p className="mt-3 text-[10px] leading-relaxed text-amber/70">
              Instala k6 o Docker para ejecutar pruebas.
            </p>
          )}
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="glass sticky top-0 z-20 flex flex-wrap items-center justify-between gap-3 border-b border-line px-4 py-3 lg:px-8">
          <h1 className="text-base font-semibold tracking-wide text-sky/90">
            {NAV_ITEMS.find((item) => item.view === view)?.label ?? "Tablero"}
          </h1>
          <div className="lg:hidden">
            <StatusBlock health={health} connected={connected} activeRun={activeRun} />
          </div>
        </header>
        <main className="min-w-0 flex-1 overflow-x-clip px-4 py-5 lg:px-8 lg:py-7">{children}</main>
      </div>
    </div>
  );
}
