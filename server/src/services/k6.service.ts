import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { env } from "../config/env.js";
import type { Scenario } from "../models/types.js";
import { translateK6Log } from "./k6-log-translator.js";

export type K6Mode = "local" | "docker";

export interface K6Availability {
  available: boolean;
  version: string | null;
  mode: K6Mode | null;
}

let cachedAvailability: K6Availability | null = null;

function runCommand(command: string, timeoutMs = 5_000): Promise<{ code: number | null; stdout: string }> {
  return new Promise((resolve) => {
    const child = spawn(command, { stdio: "pipe", shell: true });
    let stdout = "";
    let settled = false;

    const finish = (code: number | null) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve({ code, stdout });
    };

    child.stdout.on("data", (chunk) => {
      stdout += String(chunk);
    });
    child.on("error", () => finish(null));
    child.on("exit", (code) => finish(code));

    const timer = setTimeout(() => {
      child.kill();
      finish(null);
    }, timeoutMs);
  });
}

export async function detectK6(force = false): Promise<K6Availability> {
  if (cachedAvailability && !force) return cachedAvailability;

  const local = await runCommand("k6 version");
  if (local.code === 0) {
    cachedAvailability = {
      available: true,
      version: local.stdout.trim().split("\n")[0] ?? "k6",
      mode: "local",
    };
    return cachedAvailability;
  }

  const docker = await runCommand("docker version --format '{{.Server.Version}}'", 8_000);
  if (docker.code === 0) {
    const dockerVersion = docker.stdout.trim();
    cachedAvailability = {
      available: true,
      version: `k6 vía Docker (${env.k6DockerImage}${dockerVersion ? `, Docker ${dockerVersion}` : ""})`,
      mode: "docker",
    };
    return cachedAvailability;
  }

  cachedAvailability = { available: false, version: null, mode: null };
  return cachedAvailability;
}

function buildThresholds(scenario: Scenario): string {
  const durationRules: string[] = [];
  if (scenario.thresholds.p95Ms) durationRules.push(`p(95)<${scenario.thresholds.p95Ms}`);
  if (scenario.thresholds.p99Ms) durationRules.push(`p(99)<${scenario.thresholds.p99Ms}`);

  const rules: string[] = [];
  if (durationRules.length > 0) {
    rules.push(`    http_req_duration: [${durationRules.map((rule) => `'${rule}'`).join(", ")}]`);
  }
  if (scenario.thresholds.maxErrorRate !== null && scenario.thresholds.maxErrorRate !== undefined) {
    rules.push(`    http_req_failed: ['rate<${scenario.thresholds.maxErrorRate}']`);
  }
  if (rules.length === 0) {
    return "  thresholds: {},";
  }
  return `  thresholds: {\n${rules.join(",\n")},\n  },`;
}

function buildScenarioBlock(scenario: Scenario): string {
  if (scenario.loadMode === "constant-arrival-rate") {
    return `  scenarios: {
    main: {
      executor: 'constant-arrival-rate',
      rate: ${scenario.arrivalRate ?? 10},
      timeUnit: '1s',
      duration: '${scenario.duration ?? "30s"}',
      preAllocatedVUs: ${scenario.preAllocatedVUs},
      maxVUs: ${scenario.maxVUs},
    },
  },`;
  }

  const stages = scenario.stages
    .map((stage) => `      { duration: '${stage.duration}', target: ${stage.target} },`)
    .join("\n");
  return `  scenarios: {
    main: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
${stages}
      ],
      gracefulRampDown: '10s',
    },
  },`;
}

export function generateScript(scenario: Scenario): string {
  const headers = JSON.stringify(scenario.headers);
  const body = scenario.body ? JSON.stringify(scenario.body) : "null";
  const expected = scenario.expectedStatus;
  const method = scenario.method;

  return `import http from 'k6/http';
import { check, sleep } from 'k6';

export const options = {
${buildScenarioBlock(scenario)}
${buildThresholds(scenario)}
  summaryTrendStats: ['avg', 'p(50)', 'p(90)', 'p(95)', 'p(99)', 'min', 'max'],
};

const TARGET = ${JSON.stringify(scenario.url)};
const METHOD = ${JSON.stringify(method)};
const HEADERS = ${headers};
const BODY = ${body};
const THINK_TIME = ${scenario.thinkTime};
const EXPECTED_STATUS = ${expected};
const FOLLOW_REDIRECTS = ${scenario.followRedirects};
const INSECURE_TLS = ${scenario.insecureTls};

export default function () {
  const response = http.request(METHOD, TARGET, BODY, {
    headers: HEADERS,
    followRedirects: FOLLOW_REDIRECTS,
    insecureSkipTLSVerify: INSECURE_TLS,
    timeout: '60s',
  });

  check(response, {
    'status esperado': (r) => r.status === EXPECTED_STATUS,
  });

  if (THINK_TIME > 0) {
    sleep(THINK_TIME);
  }
}
`;
}

export interface K6RunHandlers {
  onMetrics: (lines: string[]) => void;
  onLog: (line: string) => void;
  onExit: (code: number | null, signal: NodeJS.Signals | null) => void;
}

export interface K6ProcessHandle {
  stop: () => void;
}

function quote(part: string): string {
  return /\s/.test(part) ? `"${part}"` : part;
}

function killProcessTree(pid: number): void {
  if (process.platform === "win32") {
    spawn(`taskkill /PID ${pid} /T /F`, { shell: true, stdio: "ignore" });
  } else {
    try {
      process.kill(-pid, "SIGTERM");
    } catch {
      try {
        process.kill(pid, "SIGTERM");
      } catch {
        // already exited
      }
    }
  }
}

export function startK6(options: {
  runId: string;
  runDir: string;
  scriptPath: string;
  summaryPath: string;
  mode: K6Mode;
  handlers: K6RunHandlers;
}): K6ProcessHandle {
  let command: string;
  let containerName: string | null = null;

  if (options.mode === "docker") {
    containerName = `stresslab-k6-${options.runId.slice(0, 8)}`;
    const dockerArgs = [
      "run",
      "--rm",
      "-i",
      "--name",
      containerName,
      "--add-host",
      "host.docker.internal:host-gateway",
      "-v",
      `${options.runDir}:/data`,
      env.k6DockerImage,
      "run",
      "--out",
      "json",
      "--summary-export",
      "/data/summary.json",
      "/data/script.js",
    ];
    command = ["docker", ...dockerArgs].map(quote).join(" ");
  } else {
    const k6Args = [
      "run",
      "--out",
      "json",
      "--summary-export",
      options.summaryPath,
      options.scriptPath,
    ];
    command = ["k6", ...k6Args].map(quote).join(" ");
  }

  const child = spawn(command, {
    stdio: ["ignore", "pipe", "pipe"],
    shell: true,
    env: { ...process.env },
  });

  const consumeLines = (
    chunk: string,
    buffer: string,
    onLine: (line: string) => void,
  ): string => {
    const lines = `${buffer}${chunk}`.split(/\r\n|\n|\r/);
    const remainder = lines.pop() ?? "";
    for (const line of lines) {
      if (line.trim()) onLine(line);
    }
    return remainder;
  };

  let stdoutBuffer = "";
  child.stdout.on("data", (chunk: Buffer) => {
    stdoutBuffer = consumeLines(chunk.toString("utf8"), stdoutBuffer, (line) => {
      if (line.trim().startsWith("{")) {
        options.handlers.onMetrics([line]);
      } else {
        options.handlers.onLog(translateK6Log(line));
      }
    });
  });

  let stderrBuffer = "";
  child.stderr.on("data", (chunk: Buffer) => {
    stderrBuffer = consumeLines(
      chunk.toString("utf8"),
      stderrBuffer,
      (line) => options.handlers.onLog(translateK6Log(line)),
    );
  });

  child.on("error", (error) => {
    options.handlers.onLog(`Error al iniciar k6: ${error.message}`);
    options.handlers.onExit(null, null);
  });

  child.on("exit", (code, signal) => {
    if (stdoutBuffer.trim()) {
      if (stdoutBuffer.trim().startsWith("{")) {
        options.handlers.onMetrics([stdoutBuffer]);
      } else {
        options.handlers.onLog(translateK6Log(stdoutBuffer));
      }
    }
    if (stderrBuffer.trim()) options.handlers.onLog(translateK6Log(stderrBuffer));
    options.handlers.onExit(code, signal);
  });

  return {
    stop: () => {
      if (containerName) {
        spawn(`docker stop ${containerName}`, { shell: true, stdio: "ignore" });
        setTimeout(() => {
          if (!child.killed) child.kill();
        }, 8_000).unref?.();
        return;
      }
      if (!child.killed && child.pid) {
        killProcessTree(child.pid);
      }
    },
  };
}

export function readSummary(summaryPath: string): Record<string, unknown> | null {
  try {
    const raw = fs.readFileSync(summaryPath, "utf8");
    return JSON.parse(raw) as Record<string, unknown>;
  } catch {
    return null;
  }
}

export function removeRunDir(runDir: string): void {
  try {
    fs.rmSync(runDir, { recursive: true, force: true });
  } catch {
    // best effort cleanup
  }
}

export function k6InstallHint(): string {
  return [
    "k6 no está disponible (ni local ni Docker).",
    "Opciones:",
    "  - Instala Docker Desktop y deja corriendo el daemon",
    "  - Instala k6 local: winget install GrafanaLabs.k6",
    "  - Linux: apt-get install k6 / macOS: brew install k6",
  ].join("\n");
}
