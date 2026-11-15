import { useCallback, useEffect, useState } from "react";
import { api } from "../lib/api";
import type { Scenario, ScenarioInput } from "../lib/types";

export function useScenarios() {
  const [scenarios, setScenarios] = useState<Scenario[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      const values = await api.listScenarios();
      setScenarios(values);
      setError(null);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "No se pudieron cargar los escenarios");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const create = useCallback(async (input: ScenarioInput): Promise<Scenario> => {
    const created = await api.createScenario(input);
    setScenarios((previous) => [created, ...previous]);
    return created;
  }, []);

  const update = useCallback(async (id: string, input: ScenarioInput): Promise<Scenario> => {
    const updated = await api.updateScenario(id, input);
    setScenarios((previous) => previous.map((item) => (item.id === id ? updated : item)));
    return updated;
  }, []);

  const remove = useCallback(async (id: string): Promise<void> => {
    await api.deleteScenario(id);
    setScenarios((previous) => previous.filter((item) => item.id !== id));
  }, []);

  return { scenarios, loading, error, refresh, create, update, remove };
}
