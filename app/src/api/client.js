import AsyncStorage from "@react-native-async-storage/async-storage";
import { API_BASE, LOCAL_MODE } from "./config.js";
import { localApi } from "./local.js";

/*
 * Thin REST client for the Smart Cassava Nursery backend. Holds the JWT in
 * memory (mirrored to AsyncStorage so sessions survive app restarts) and
 * attaches it to every request.
 */

const TOKEN_KEY = "cassava.token";
let token = null;

export async function loadToken() {
  token = await AsyncStorage.getItem(TOKEN_KEY);
  return token;
}
export function getToken() {
  return token;
}
async function setToken(value) {
  token = value;
  if (value) await AsyncStorage.setItem(TOKEN_KEY, value);
  else await AsyncStorage.removeItem(TOKEN_KEY);
}

async function request(path, { method = "GET", body } = {}) {
  const res = await fetch(`${API_BASE}${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  const data = text ? JSON.parse(text) : {};
  if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`);
  return data;
}

const remoteApi = {
  // --- auth ---
  async login(phone, password) {
    const data = await request("/api/auth/login", { method: "POST", body: { phone, password } });
    await setToken(data.token);
    return data.user;
  },
  async register(phone, password, name) {
    const data = await request("/api/auth/register", { method: "POST", body: { phone, password, name } });
    await setToken(data.token);
    return data.user;
  },
  async me() {
    const data = await request("/api/auth/me");
    return data.user;
  },
  async logout() {
    await setToken(null);
  },

  // --- data ---
  latest: () => request("/api/readings/latest"),
  trend: (window = "1h", points = 24) => request(`/api/readings/trend?window=${window}&points=${points}`),
  deviceStatus: () => request("/api/devices/status"),
  alerts: (limit = 30) => request(`/api/alerts?limit=${limit}`),
  ackAlert: (id) => request(`/api/alerts/${id}/ack`, { method: "POST" }),
  reportSummary: () => request("/api/reports/summary"),
  waterSeries: () => request("/api/reports/water"),
  settings: () => request("/api/settings"),
  updateThresholds: (patch) => request("/api/settings/thresholds", { method: "PUT", body: patch }),
  updateSystem: (patch) => request("/api/settings/system", { method: "PUT", body: patch }),
  smsPreview: () => request("/api/sms-preview"),
  architecture: () => request("/api/architecture"),
};

// In local mode every call is served on-device; otherwise hit the REST backend.
export const api = LOCAL_MODE ? localApi : remoteApi;
