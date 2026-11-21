export function formatNumber(value: number, digits = 0): string {
  if (!Number.isFinite(value)) return "—";
  return new Intl.NumberFormat("es-CO", {
    maximumFractionDigits: digits,
    minimumFractionDigits: 0,
  }).format(value);
}

export function formatRps(value: number): string {
  if (!Number.isFinite(value)) return "—";
  return value.toFixed(value >= 10 ? 0 : 1);
}

export function formatLatency(value: number): string {
  if (!Number.isFinite(value)) return "—";
  if (value <= 0) return "0 ms";
  if (value < 1000) return `${value.toFixed(value < 10 ? 1 : 0)} ms`;
  return `${(value / 1000).toFixed(2)} s`;
}

export function formatPercent(rate: number, digits = 1): string {
  if (!Number.isFinite(rate)) return "—";
  return `${(rate * 100).toFixed(digits)}%`;
}

export function formatElapsed(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return "00:00";
  const total = Math.floor(seconds);
  const mins = Math.floor(total / 60);
  const secs = total % 60;
  if (mins >= 60) {
    const hours = Math.floor(mins / 60);
    return `${String(hours).padStart(2, "0")}:${String(mins % 60).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
  }
  return `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
}

export function formatDateTime(iso: string | null): string {
  if (!iso) return "—";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleString("es-CO", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function statusLabel(status: string): string {
  switch (status) {
    case "running":
      return "En curso";
    case "completed":
      return "Completada";
    case "failed":
      return "Fallida";
    case "stopped":
      return "Finalizada";
    default:
      return status;
  }
}
