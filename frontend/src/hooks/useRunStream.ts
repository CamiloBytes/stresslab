import { useCallback, useEffect, useRef, useState } from "react";
import type { LiveMetrics, Run } from "../lib/types";

export interface LivePoint {
  t: number;
  rps: number;
  avgLatencyMs: number;
  errorRate: number;
  vus: number;
}

export interface StreamLog {
  id: number;
  line: string;
}

const MAX_POINTS = 300;
const MAX_LOGS = 400;

function parseEvent<T>(event: Event): T | null {
  try {
    return JSON.parse((event as MessageEvent).data) as T;
  } catch {
    return null;
  }
}

export function useRunStream() {
  const [connected, setConnected] = useState(false);
  const [activeRun, setActiveRun] = useState<Run | null>(null);
  const [live, setLive] = useState<LiveMetrics | null>(null);
  const [series, setSeries] = useState<LivePoint[]>([]);
  const [logs, setLogs] = useState<StreamLog[]>([]);
  const currentRunId = useRef<string | null>(null);
  const logId = useRef(0);

  useEffect(() => {
    const source = new EventSource("/api/runs/stream");

    source.onopen = () => setConnected(true);
    source.onerror = () => setConnected(false);

    source.addEventListener("status", (event) => {
      const payload = parseEvent<{ run: Run }>(event);
      if (!payload?.run) return;

      if (payload.run.id !== currentRunId.current) {
        currentRunId.current = payload.run.id;
        setSeries([]);
        setLogs([]);
        setLive(null);
      }

      setActiveRun(payload.run);
      if (payload.run.status !== "running") {
        setLive(null);
      }
    });

    source.addEventListener("metrics", (event) => {
      const metrics = parseEvent<LiveMetrics>(event);
      if (!metrics) return;

      setLive(metrics);
      setSeries((previous) => {
        const next = [
          ...previous,
          {
            t: metrics.elapsedSec,
            rps: metrics.rps,
            avgLatencyMs: metrics.avgLatencyMs,
            errorRate: metrics.errorRate,
            vus: metrics.vus,
          },
        ];
        return next.length > MAX_POINTS ? next.slice(-MAX_POINTS) : next;
      });
    });

    source.addEventListener("log", (event) => {
      const payload = parseEvent<{ runId: string; line: string }>(event);
      if (!payload?.line) return;
      logId.current += 1;
      const entry = { id: logId.current, line: payload.line };
      setLogs((previous) => {
        const next = [...previous, entry];
        return next.length > MAX_LOGS ? next.slice(-MAX_LOGS) : next;
      });
    });

    return () => source.close();
  }, []);

  const reset = useCallback(() => {
    currentRunId.current = null;
    setSeries([]);
    setLogs([]);
    setLive(null);
    setActiveRun(null);
  }, []);

  return { connected, activeRun, live, series, logs, reset };
}
