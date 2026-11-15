import { useEffect, useState } from "react";
import { api } from "../lib/api";
import type { Health } from "../lib/types";

const POLL_MS = 5000;

export function useHealth(): Health | null {
  const [health, setHealth] = useState<Health | null>(null);

  useEffect(() => {
    let alive = true;

    const load = () => {
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
    const timer = window.setInterval(load, POLL_MS);
    return () => {
      alive = false;
      window.clearInterval(timer);
    };
  }, []);

  return health;
}
