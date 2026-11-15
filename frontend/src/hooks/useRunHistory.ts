import { useCallback, useEffect, useState } from "react";
import { api } from "../lib/api";
import type { Run } from "../lib/types";

export function useRunHistory() {
  const [runs, setRuns] = useState<Run[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const values = await api.listRuns(50);
      setRuns(values);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return { runs, loading, refresh };
}
