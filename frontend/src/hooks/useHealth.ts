import { useEffect, useState } from "react";
import { api } from "../lib/api";
import type { Health } from "../lib/types";

const POLL_MS = 5000;

export function useHealth(): Health | null {
  const [health, setHealth] = useState<Health | null>(null);

  useEffect(() => {
    let alive = true;

    const load = () => {
      if (document.hidden) return;
      api
        .health()
        .then((value) => {
          if (alive) setHealth(value);
        })
        .catch(() => {
          if (alive) setHealth(null);
        });
    };

    load();
    document.addEventListener('visibilitychange',load);
    const timer = window.setInterval(load, POLL_MS);
    return () => {
      alive = false;
      document.removeEventListener('visibilitychange',load);
      window.clearInterval(timer);
    };
  }, []);

  return health;
}
