import { useCallback, useEffect, useState } from "react";
import { api } from "../lib/api";
import type { Project, ProjectInput } from "../lib/types";

export function useProjects() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      const values = await api.listProjects();
      setProjects(values);
      setError(null);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "No se pudieron cargar los proyectos");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const create = useCallback(async (input: ProjectInput): Promise<Project> => {
    const created = await api.createProject(input);
    setProjects((previous) => [created, ...previous]);
    return created;
  }, []);

  const update = useCallback(async (id: string, input: ProjectInput): Promise<Project> => {
    const updated = await api.updateProject(id, input);
    setProjects((previous) => previous.map((item) => (item.id === id ? updated : item)));
    return updated;
  }, []);

  const remove = useCallback(async (id: string): Promise<void> => {
    await api.deleteProject(id);
    setProjects((previous) => previous.filter((item) => item.id !== id));
  }, []);

  return { projects, loading, error, refresh, create, update, remove };
}
