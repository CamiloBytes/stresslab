import http from "k6/http";
import { check, sleep } from "k6";

export const options = {
  vus: Number(__ENV.VUS || 1),
  duration: __ENV.DURATION || "10s"
};

export default function () {
  const response = http.get(__ENV.BASE_URL || "http://localhost:3000/api/health");
  check(response, { "health endpoint responds": (res) => res.status === 200 });
  sleep(1);
}
