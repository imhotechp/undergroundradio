// Load test for the read-heavy authenticated endpoints (/me/, /playlists/, /ground/).
//
// Requires a real test account on the target environment (never a real user's
// login) — create one via signup first. LoginView/AccountView are throttled to
// 10/min (see REST_FRAMEWORK.DEFAULT_THROTTLE_RATES in settings.py), so this
// script logs in once in setup() and reuses that token across every VU/iteration
// instead of logging in per iteration, which would immediately 429.
//
// Caveat: access tokens expire after 5 minutes (see ug_radio_ux/src/app/lib/api.ts).
// Keep total run duration under that, or extend this script to call
// /token/refresh/ periodically if you need longer soak tests.
//
// Run:
//   BASE_URL=https://undergroundradio.us/api \
//   LOAD_TEST_USERNAME=youtestuser \
//   LOAD_TEST_PASSWORD=yourtestpass \
//   k6 run deploy/k6/load-test.js

import http from "k6/http";
import { check, sleep } from "k6";

const BASE_URL = __ENV.BASE_URL || "http://127.0.0.1:8000";
const USERNAME = __ENV.LOAD_TEST_USERNAME;
const PASSWORD = __ENV.LOAD_TEST_PASSWORD;

export const options = {
  scenarios: {
    ramping: {
      executor: "ramping-vus",
      startVUs: 0,
      stages: [
        { duration: "30s", target: 20 },
        { duration: "1m", target: 50 },
        { duration: "30s", target: 0 },
      ],
    },
  },
  thresholds: {
    http_req_failed: ["rate<0.01"],
    http_req_duration: ["p(95)<500"],
  },
};

export function setup() {
  if (!USERNAME || !PASSWORD) {
    throw new Error(
      "Set LOAD_TEST_USERNAME and LOAD_TEST_PASSWORD to a real test account before running.",
    );
  }
  const res = http.post(
    `${BASE_URL}/login/`,
    JSON.stringify({ username: USERNAME, password: PASSWORD }),
    { headers: { "Content-Type": "application/json" } },
  );
  if (res.status !== 200) {
    throw new Error(`Login failed (status ${res.status}): ${res.body}`);
  }
  return { access: res.json("access") };
}

export default function (data) {
  const headers = { Authorization: `Bearer ${data.access}` };

  const responses = http.batch([
    ["GET", `${BASE_URL}/me/`, null, { headers }],
    ["GET", `${BASE_URL}/playlists/`, null, { headers }],
    ["GET", `${BASE_URL}/ground/`, null, { headers }],
  ]);

  for (const res of responses) {
    check(res, { "status is 200": (r) => r.status === 200 });
  }

  sleep(1);
}
