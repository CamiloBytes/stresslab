import fs from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { env } from "../config/env.js";
import { HttpError } from "../middleware/http-error.js";
import { scenarioRepository } from "../models/scenario.repository.js";
import { runRepository } from "../models/run.repository.js";
import type { LiveMetrics, Run, RunSummary, Scenario, ThresholdResult } from "../models/types.js";
import {
  detectK6,
  generateScript,
  k6InstallHint,
  readSummary,
  removeRunDir,
  startK6,
  type K6ProcessHandle,
} from "./k6.service.js";
import { sseHub } from "./sse.service.js";

interface K6Point {
  type?: string;
  metric?: string;
  data?: { value?: number; tags?: Record<string, string> };
}

interface MetricAccumulator {
  startedAtMs: number;
  requests: number;
  errorCount: number;
  errorSamples: number;
  latencySum: number;
  latencyCount: number;
  vus: number;
  iterations: number;
  checksPasses: number;
  checksFails: number;
  windowRequests: number;
  windowStartedAtMs: number;
  rps: number;
}

interface ActiveRun {
  run: Run;
  handle: K6ProcessHandle;
  runDir: string;
  acc: MetricAccumulator;
  stopping: boolean;
}

function initialAccumulator(): MetricAccumulator {
  const now = Date.now();
  return {
    startedAtMs: now,
    requests: 0,
    errorCount: 0,
    errorSamples: 0,
    latencySum: 0,
    latencyCount: 0,
    vus: 0,
    iterations: 0,
    checksPasses: 0,
    checksFails: 0,
    windowRequests: 0,
    windowStartedAtMs: now,
    rps: 0,
  };
}

function summarizePoint(point: K6Point, acc: MetricAccumulator): void {
  const metric = point.metric;
  const value = point.data?.value;
  if (!metric || typeof value !== "number") return;

  switch (metric) {
    case "http_reqs": {
      acc.requests += value;
      acc.windowRequests += value;
      break;
    }
    case "http_req_failed": {
      acc.errorCount += value;
      acc.errorSamples += 1;
      break;
    }
    case "http_req_duration": {
      acc.latencySum += value;
      acc.latencyCount += 1;
      break;
    }
    case "vus": {
      acc.vus = value;
      break;
    }
    case "iterations": {
      acc.iterations += value;
      break;
    }
    case "checks": {
      if (value >= 0.5) acc.checksPasses += 1;
      else acc.checksFails += 1;
      break;
    }
    default:
      break;
  }
}

function toLiveMetrics(acc: MetricAccumulator): LiveMetrics {
  const elapsedMs = Date.now() - acc.startedAtMs;
  const elapsedSec = Math.max(elapsedMs / 1000, 1);
  const windowSec = Math.max((Date.now() - acc.windowStartedAtMs) / 1000, 1);
  const rps = acc.windowRequests / windowSec;

  return {
    elapsedSec,
    requests: acc.requests,
    errors: acc.errorCount,
    errorRate: acc.errorSamples > 0 ? acc.errorCount / acc.errorSamples : 0,
    rps,
    avgLatencyMs: acc.latencyCount > 0 ? acc.latencySum / acc.latencyCount : 0,
    vus: acc.vus,
    iterations: acc.iterations,
    checksRate:
      acc.checksPasses + acc.checksFails > 0
        ? acc.checksPasses / (acc.checksPasses + acc.checksFails)
        : 1,
  };
}

interface SummaryMetrics {
  metrics?: Record<string, Record<string, unknown>>;
}

function valuesOf(metrics: Record<string, Record<string, unknown>> | undefined, name: string): Record<string, number> {
  const entry = metrics?.[name];
  if (!entry || typeof entry !== "object") return {};
  const nested = entry.values;
  const source = nested && typeof nested === "object" ? (nested as Record<string, unknown>) : entry;
  const result: Record<string, number> = {};
  for (const [key, value] of Object.entries(source)) {
    if (typeof value === "number") result[key] = value;
  }
  return result;
}

function numeric(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function evaluateThresholds(scenario: Scenario, summary: Omit<RunSummary, "thresholds">): ThresholdResult[] {  const results: ThresholdResult[] = [];
  const { p95Ms, p99Ms, maxErrorRate } = scenario.thresholds;

  if (p95Ms) {
    results.push({
      label: `p95 < ${p95Ms} ms`,
      passed: summary.p95Ms <= p95Ms,
      actual: summary.p95Ms,
      target: p95Ms,
    });
  }
  if (p99Ms) {
    results.push({
      label: `p99 < ${p99Ms} ms`,
      passed: summary.p99Ms <= p99Ms,
      actual: summary.p99Ms,
      target: p99Ms,
    });
  }
  if (maxErrorRate !== null && maxErrorRate !== undefined) {
    results.push({
      label: `errores < ${(maxErrorRate * 100).toFixed(1)}%`,
      passed: summary.errorRate <= maxErrorRate,
      actual: summary.errorRate,
      target: maxErrorRate,
    });
  }

  return results;
}

function extractSummary(raw: unknown, elapsedSec: number, scenario: Scenario): RunSummary {
  const data = raw as SummaryMetrics;
  const metrics = data?.metrics;
  const reqs = valuesOf(metrics, "http_reqs");
  const duration = valuesOf(metrics, "http_req_duration");
  const failed = valuesOf(metrics, "http_req_failed");
  const iterations = valuesOf(metrics, "iterations");
  const checks = valuesOf(metrics, "checks");

  const requests = numeric(reqs.count);
  const failedFails = numeric(failed.fails);
  const failedPasses = numeric(failed.passes);
  const errorRate =
    failed.value !== undefined
      ? failed.value
      : failed.rate !== undefined
        ? failed.rate
        : failedFails + failedPasses > 0
          ? failedFails / (failedFails + failedPasses)
          : 0;

  const base = {
    requests,
    errors: Math.round(requests * errorRate),
    errorRate,
    avgLatencyMs: numeric(duration.avg),
    p95Ms: numeric(duration["p(95)"]),
    p99Ms: numeric(duration["p(99)"]),
    rps: numeric(reqs.rate) || (elapsedSec > 0 ? requests / elapsedSec : 0),
    iterations: numeric(iterations.count),
    checksRate: numeric(checks.value) || numeric(checks.rate) || 1,
    durationSec: elapsedSec,
  } satisfies Omit<RunSummary, "thresholds">;

  return { ...base, thresholds: evaluateThresholds(scenario, base) };
}

const LOCAL_HOSTNAMES = new Set(["localhost", "127.0.0.1", "::1", "[::1]"]);

function rewriteLocalhostForDocker(url: string): string {
  try {
    const parsed = new URL(url);
    if (LOCAL_HOSTNAMES.has(parsed.hostname)) {
      parsed.hostname = "host.docker.internal";
      return parsed.toString();
    }
  } catch {
    // invalid URLs are rejected by validation elsewhere
  }
  return url;
}

class RunService {
  private active: ActiveRun | null = null;

  getActive(): { run: Run; metrics: LiveMetrics } | null {
    if (!this.active) return null;
    return {
      run: this.active.run,
      metrics: toLiveMetrics(this.active.acc),
    };
  }

  async start(scenarioId: string): Promise<Run> {
    if (this.active) {
      throw new HttpError(409, "Ya hay una corrida en curso. Detén la actual antes de iniciar otra.");
    }

    const availability = await detectK6();
    if (!availability.available) {
      throw new HttpError(503, k6InstallHint());
    }

    const scenario = await scenarioRepository.get(scenarioId);
    if (!scenario) {
      throw new HttpError(404, "Escenario no encontrado");
    }

    const runId = randomUUID();
    const runDir = path.resolve(env.runsDir, runId);
    fs.mkdirSync(runDir, { recursive: true });

    const scriptPath = path.join(runDir, "script.js");
    const summaryPath = path.join(runDir, "summary.json");
    const dockerMode = availability.mode === "docker";
    const targetUrl = dockerMode ? rewriteLocalhostForDocker(scenario.url) : scenario.url;
    fs.writeFileSync(
      scriptPath,
      generateScript({ ...scenario, url: targetUrl }),
      "utf8",
    );

    const run = await runRepository.create({
      id: runId,
      scenarioId: scenario.id,
      scenarioName: scenario.name,
      startedAt: new Date().toISOString(),
    });

    const acc = initialAccumulator();
    let flushTimer: NodeJS.Timeout | null = null;

    const flushMetrics = () => {
      sseHub.broadcast("metrics", { runId, ...toLiveMetrics(acc) });
    };

    const handle = startK6({
      runId,
      runDir,
      scriptPath,
      summaryPath,
      mode: availability.mode ?? "local",
      handlers: {
        onMetrics: (lines) => {
          for (const line of lines) {
            try {
              const point = JSON.parse(line) as K6Point;
              summarizePoint(point, acc);
            } catch {
              // ignore malformed metric lines
            }
          }
          if (!flushTimer) {
            flushTimer = setTimeout(() => {
              flushTimer = null;
              flushMetrics();
            }, 500);
          }
        },
        onLog: (line) => {
          sseHub.broadcast("log", { runId, line });
        },
        onExit: async (code) => {
          if (flushTimer) {
            clearTimeout(flushTimer);
            flushTimer = null;
          }
          const elapsedSec = (Date.now() - acc.startedAtMs) / 1000;
          const rawSummary = readSummary(summaryPath);
          const usableSummary =
            rawSummary && (rawSummary as SummaryMetrics).metrics?.http_reqs ? rawSummary : null;

          let summary: RunSummary;
          if (usableSummary) {
            summary = extractSummary(usableSummary, elapsedSec, scenario);
          } else {
            const live = toLiveMetrics(acc);
            const base = {
              requests: live.requests,
              errors: live.errors,
              errorRate: live.errorRate,
              avgLatencyMs: live.avgLatencyMs,
              p95Ms: 0,
              p99Ms: 0,
              rps: live.rps,
              iterations: live.iterations,
              checksRate: live.checksRate,
              durationSec: elapsedSec,
            } satisfies Omit<RunSummary, "thresholds">;
            summary = { ...base, thresholds: evaluateThresholds(scenario, base) };
          }

          const wasStopping = this.active?.stopping ?? false;
          const status = wasStopping ? "stopped" : code === 0 ? "completed" : "failed";

          await runRepository.update(runId, {
            status,
            endedAt: new Date().toISOString(),
            summary,
            error:
              status === "failed"
                ? `k6 terminó con código ${code ?? "desconocido"}`
                : null,
          });

          const finished = await runRepository.get(runId);
          sseHub.broadcast("status", { run: finished });
          sseHub.broadcast("metrics", { runId, ...toLiveMetrics(acc) });

          if (flushTimer) clearTimeout(flushTimer);
          if (this.active?.run.id === runId) {
            this.active = null;
          }
          setTimeout(() => removeRunDir(runDir), 60_000).unref?.();
        },
      },
    });

    this.active = { run, handle, runDir, acc, stopping: false };
    sseHub.broadcast("status", { run });
    sseHub.broadcast("metrics", { runId, ...toLiveMetrics(acc) });
    sseHub.broadcast("log", {
      runId,
      line: "Compilando prueba: script k6 generado y escenario validado.",
    });
    sseHub.broadcast("log", {
      runId,
      line: `Iniciando proceso k6 en ${availability.mode === "docker" ? "Docker" : "local"}.`,
    });
    if (dockerMode && targetUrl !== scenario.url) {
      sseHub.broadcast("log", {
        runId,
        line: `nota: localhost se resuelve como host.docker.internal dentro del contenedor k6 → ${targetUrl}`,
      });
    }
    return run;
  }

  stop(): Run {
    if (!this.active) {
      throw new HttpError(404, "No hay ninguna corrida en curso");
    }
    this.active.stopping = true;
    this.active.handle.stop();
    return this.active.run;
  }
}

export const runService = new RunService();
