import { lazy, Suspense, useCallback, useEffect, useRef, useState } from "react";
import { api } from "./lib/api";
import type { Scenario, ScenarioInput } from "./lib/types";
import { useHealth } from "./hooks/useHealth";
import { useProjects } from "./hooks/useProjects";
import { useRunHistory } from "./hooks/useRunHistory";
import { useRunStream } from "./hooks/useRunStream";
import { useScenarios } from "./hooks/useScenarios";
import { useToast } from "./hooks/useToast";
import { AppShell, type View } from "./components/layout/AppShell";
const DashboardPage = lazy(() => import('./pages/DashboardPage').then(m => ({default:m.DashboardPage})));
const HistoryPage = lazy(() => import('./pages/HistoryPage').then(m => ({default:m.HistoryPage})));
const ScenariosPage = lazy(() => import('./pages/ScenariosPage').then(m => ({default:m.ScenariosPage})));
const SecurityPage = lazy(() => import('./pages/SecurityPage').then(m => ({default:m.SecurityPage})));

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Error inesperado";
}

export default function App() {
  const [view, setView] = useState<View>("dashboard");
  const [selectedScenarioId, setSelectedScenarioId] = useState("");
  const [selectedRunId, setSelectedRunId] = useState<string | null>(null);
  const [starting, setStarting] = useState(false);

  const health = useHealth();
  const { scenarios, loading: scenariosLoading, create, update, remove } = useScenarios();
  const { projects, loading: projectsLoading, refresh: refreshProjects } = useProjects();
  const { connected, activeRun, live, series, logs, reset } = useRunStream();
  const { runs, refresh: refreshRuns } = useRunHistory();
  const { push: pushToast } = useToast();

  useEffect(() => {
    if (scenarios.length === 0) {
      if (selectedScenarioId !== "") setSelectedScenarioId("");
      return;
    }
    if (!scenarios.some((scenario) => scenario.id === selectedScenarioId)) {
      setSelectedScenarioId(scenarios[0].id);
    }
  }, [scenarios, selectedScenarioId]);

  const previousStatus = useRef<string | null>(null);

  useEffect(() => {
    const status = activeRun?.status ?? null;
    const wasRunning = previousStatus.current === "running";
    previousStatus.current = status;

    if (!wasRunning || status === null || status === "running") return;

    void refreshRuns();
    if (status === "completed") pushToast("Prueba completada — revisa el resumen en el tablero.", "success");
    else if (status === "failed") pushToast("La prueba terminó con errores.", "error");
    else pushToast("Prueba finalizada por el usuario.", "info");
  }, [activeRun?.status, pushToast, refreshRuns]);

  const startScenario = useCallback(
    async (scenarioId: string) => {
      if (!scenarioId) return;
      setStarting(true);
      try {
        reset();
        setSelectedRunId(null);
        await api.startRun(scenarioId);
        setView("dashboard");
        pushToast("Prueba iniciada.", "success");
      } catch (error) {
        pushToast(errorMessage(error), "error");
      } finally {
        setStarting(false);
      }
    },
    [pushToast, reset],
  );

  const handleStop = useCallback(async () => {
    try {
      await api.stopRun();
    } catch (error) {
      pushToast(errorMessage(error), "error");
    }
  }, [pushToast]);

  const handleRunAgain = useCallback(
    (scenarioId: string) => {
      void startScenario(scenarioId);
    },
    [startScenario],
  );

  const handleRunScenario = useCallback(
    (scenario: Scenario) => {
      setSelectedScenarioId(scenario.id);
      void startScenario(scenario.id);
    },
    [startScenario],
  );

  const handleCreate = useCallback(
    async (input: ScenarioInput) => {
      const created = await create(input);
      setSelectedScenarioId(created.id);
      pushToast(`Escenario «${created.name}» creado.`, "success");
    },
    [create, pushToast],
  );

  const handleUpdate = useCallback(
    async (id: string, input: ScenarioInput) => {
      await update(id, input);
      pushToast("Escenario actualizado.", "success");
    },
    [update, pushToast],
  );

  const handleDelete = useCallback(
    async (id: string) => {
      await remove(id);
      pushToast("Escenario eliminado.", "info");
    },
    [remove, pushToast],
  );

  const busy = starting || activeRun?.status === "running";
  const allRuns = activeRun ? [activeRun, ...runs.filter((run) => run.id !== activeRun.id)] : runs;
  const recentRuns = allRuns.slice(0, 5);
  const selectedRun = allRuns.find((run) => run.id === selectedRunId)
    ?? (activeRun?.status === "running" ? activeRun : allRuns[0] ?? null);

  return (
    <AppShell view={view} onNavigate={setView} health={health} connected={connected} activeRun={activeRun}>
      <Suspense fallback={<p role="status">Cargando vista…</p>}>
      {view === "dashboard" ? (
        <DashboardPage
          scenarios={scenarios}
          selectedId={selectedScenarioId}
          onSelectScenario={setSelectedScenarioId}
          activeRun={activeRun}
          live={live}
          series={series}
          logs={logs}
          connected={connected}
          health={health}
          starting={starting}
          recentRuns={recentRuns}
          selectedRun={selectedRun}
          onSelectRun={(run) => setSelectedRunId(run.id)}
          onRunAgain={handleRunAgain}
          runAgainDisabled={Boolean(busy)}
          onStart={() => void startScenario(selectedScenarioId)}
          onStop={() => void handleStop()}
        />
      ) : null}

      {view === "scenarios" ? (
        <ScenariosPage
          scenarios={scenarios}
          projects={projects}
          loading={scenariosLoading}
          busy={Boolean(busy)}
          onCreate={handleCreate}
          onUpdate={handleUpdate}
          onDelete={handleDelete}
          onRun={handleRunScenario}
        />
      ) : null}

      {view === "history" ? (
        <HistoryPage
          runs={runs}
          loading={false}
          onRunAgain={handleRunAgain}
          runAgainDisabled={Boolean(busy)}
        />
      ) : null}

      {view === "security" ? (
        <SecurityPage
          projects={projects}
          loadingProjects={projectsLoading}
          onProjectsChange={refreshProjects}
          onToast={pushToast}
        />
      ) : null}
      </Suspense>
    </AppShell>
  );
}
