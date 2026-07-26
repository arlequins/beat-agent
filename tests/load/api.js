import { check, sleep } from "k6";
import http from "k6/http";

export const options = {
  thresholds: {
    http_req_duration: ["p(95)<500"],
    http_req_failed: ["rate<0.01"],
  },
  scenarios: {
    baseline: { executor: "constant-vus", vus: 10, duration: "30s" },
  },
};

export default function () {
  const baseUrl = __ENV.API_URL || "http://localhost:5000";
  const response = http.get(`${baseUrl}/health/live`);
  check(response, { "liveness is healthy": (result) => result.status === 200 });
  sleep(1);
}
