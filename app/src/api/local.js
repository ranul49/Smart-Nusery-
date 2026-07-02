/*
 * On-device "local mode" backend.
 *
 * This is a self-contained JavaScript port of the Node backend's Smart Farming
 * Cycle engine + ESP32 simulator (see backend/src/lib/engine.js & simulator.js).
 * When LOCAL_MODE is on, the app generates and processes its own nursery data
 * entirely on the phone — no server, no LAN, no internet required. The method
 * signatures and return shapes match the REST client exactly, so the screens
 * don't know the difference.
 */

const DEFAULT_THRESHOLDS = {
  humidityMin: 85,
  humidityRelease: 88,
  tempMax: 30,
  tempRelease: 28.5,
  soilMin: 60,
  approachBandPct: 5,
};
const SAMPLE_INTERVAL_SEC = 5;
const PUMP_FLOW_LPH = 240;
const EWMA_ALPHA = 0.3;
const MAX_READINGS = 1600;

// ---- in-memory state ----
const state = {
  user: null,
  device: {
    id: "dev_local",
    name: "ESP32-NURSERY-A1",
    tunnel: "Tunnel A",
    firmware: "v2.4.1",
    seedlings: 450,
    status: "online",
    pumpOn: false,
    fanOn: false,
  },
  thresholds: { ...DEFAULT_THRESHOLDS },
  readings: [],
  alerts: [],
  events: [],
  sim: { hum: 89, temp: 27.5, soil: 74, light: 850, phase: Math.random() * 6.28, ewmaHum: null, ewmaTemp: null, ewmaSoil: null, lastTick: Date.now() },
  listeners: new Set(),
  started: false,
};

let seq = 0;
const uid = (p) => `${p}_${(seq++).toString(36)}${Date.now().toString(36)}`;
const round = (n, d = 1) => { const f = 10 ** d; return Math.round(n * f) / f; };
const jitter = (m) => (Math.random() - 0.5) * m;
const ewma = (prev, next) => (prev == null ? next : EWMA_ALPHA * next + (1 - EWMA_ALPHA) * prev);

function emit(type, payload) {
  for (const cb of state.listeners) cb(type, payload);
}

const ICONS = { Critical: "AlertTriangle", Warning: "Thermometer", Resolved: "CheckCircle2", Info: "Activity" };

function raiseAlert(a) {
  const row = {
    id: uid("alert"), deviceId: state.device.id, ts: a.ts, level: a.level, variable: a.variable,
    title: a.title, sub: a.sub, value: a.value ?? null, unit: a.unit ?? "", threshold: a.threshold ?? null,
    action: a.action ?? "", acknowledged: false, smsSent: a.level === "Critical" || a.level === "Warning",
  };
  state.alerts.push(row);
  emit("alert", row);
  return row;
}

function logEvent(actuator, on, trigger, value, unit, threshold, ts) {
  const e = { id: uid("act"), deviceId: state.device.id, ts, deviceTs: ts, actuator, state: on ? "ON" : "OFF", trigger, value, unit, threshold };
  state.events.push(e);
  emit("actuator", e);
}

// Core Smart Farming Cycle: Observe -> Diagnose -> Decide -> Act.
function processSample(raw, ts = new Date().toISOString()) {
  const th = state.thresholds;
  const s = state.sim;
  const hums = raw.humidity, temps = raw.temperature, soils = raw.soil;

  const meanHum = hums.reduce((a, b) => a + b, 0) / hums.length;
  const maxTemp = Math.max(...temps);
  const meanSoil = soils.reduce((a, b) => a + b, 0) / soils.length;

  s.ewmaHum = ewma(s.ewmaHum, meanHum);
  s.ewmaTemp = ewma(s.ewmaTemp, maxTemp);
  s.ewmaSoil = ewma(s.ewmaSoil, meanSoil);
  const hum = round(s.ewmaHum);
  const temp = round(s.ewmaTemp);
  const soil = round(s.ewmaSoil, 0);
  const light = raw.light != null ? Math.round(raw.light) : null;

  const humBreach = hums.filter((h) => h < th.humidityMin).length >= 2; // 2-of-3 quorum
  const tempBreach = maxTemp > th.tempMax;
  const soilBreach = soil < th.soilMin;
  // APPROACH = within a small margin of breaching (not the whole healthy band).
  const humApproach = !humBreach && hum <= th.humidityMin + 2.5;
  const tempApproach = !tempBreach && temp >= th.tempMax - 1.5;

  let status = "NOMINAL";
  if (humBreach || tempBreach || soilBreach) status = "BREACH";
  else if (humApproach || tempApproach) status = "APPROACH";

  const d = state.device;
  if (humBreach && !d.pumpOn) {
    d.pumpOn = true;
    logEvent("pump", true, "humidity", hum, "%", th.humidityMin, ts);
    raiseAlert({ ts, level: "Critical", variable: "Humidity", title: `Humidity dropped below ${th.humidityMin}%`, sub: "Misting pump activated automatically", value: hum, unit: "%", threshold: th.humidityMin, action: "Pump activated" });
  } else if (d.pumpOn && hum >= th.humidityRelease) {
    d.pumpOn = false;
    logEvent("pump", false, "humidity", hum, "%", th.humidityRelease, ts);
    raiseAlert({ ts, level: "Resolved", variable: "Humidity", title: "Humidity restored", sub: "Misting pump turned off", value: hum, unit: "%", threshold: th.humidityRelease, action: "Pump off" });
  }
  if (tempBreach && !d.fanOn) {
    d.fanOn = true;
    logEvent("fan", true, "temperature", round(maxTemp), "°C", th.tempMax, ts);
    raiseAlert({ ts, level: "Warning", variable: "Temperature", title: `Temperature reached ${round(maxTemp)}°C`, sub: "Cooling fan activated", value: round(maxTemp), unit: "°C", threshold: th.tempMax, action: "Cooling fan activated" });
  } else if (d.fanOn && temp <= th.tempRelease) {
    d.fanOn = false;
    logEvent("fan", false, "temperature", temp, "°C", th.tempRelease, ts);
    raiseAlert({ ts, level: "Resolved", variable: "Temperature", title: "Temperature normalised", sub: "Cooling fan turned off", value: temp, unit: "°C", threshold: th.tempRelease, action: "Fan off" });
  }

  const waterDeltaL = d.pumpOn ? round((PUMP_FLOW_LPH / 3600) * SAMPLE_INTERVAL_SEC, 4) : 0;
  const reading = { id: uid("r"), deviceId: d.id, ts, deviceTs: ts, temp, humidity: hum, soil, light, status, pumpOn: d.pumpOn, fanOn: d.fanOn, waterDeltaL };
  state.readings.push(reading);
  if (state.readings.length > MAX_READINGS) state.readings.splice(0, state.readings.length - MAX_READINGS);
  emit("reading", reading);
  return reading;
}

// Mean-reverting virtual tunnel (same model as the server simulator).
function tick() {
  const s = state.sim, d = state.device;
  s.phase += 0.15;
  s.hum += (88.5 - s.hum) * 0.05 + (d.pumpOn ? 0.9 : 0) + Math.sin(s.phase) * 0.3 + jitter(0.5);
  if (Math.random() < 0.02) s.hum -= 3.4;
  s.hum = Math.max(78, Math.min(96, s.hum));
  s.temp += (27.2 - s.temp) * 0.05 - (d.fanOn ? 0.7 : 0) + Math.sin(s.phase / 2) * 0.25 + jitter(0.4);
  if (Math.random() < 0.018) s.temp += 3.4;
  s.temp = Math.max(24, Math.min(33, s.temp));
  s.soil += (73 - s.soil) * 0.05 + (d.pumpOn ? 0.4 : 0) + jitter(0.5);
  s.soil = Math.max(60, Math.min(82, s.soil));
  s.light = Math.max(200, Math.min(1100, s.light + jitter(80)));

  processSample({
    humidity: [s.hum + jitter(1.5), s.hum + jitter(1.5), s.hum + jitter(1.5)].map((v) => round(v)),
    temperature: [s.temp + jitter(0.6), s.temp + jitter(0.6), s.temp + jitter(0.6)].map((v) => round(v)),
    soil: [Math.round(s.soil + jitter(1.5)), Math.round(s.soil + jitter(1.5))],
    light: Math.round(s.light),
  });
}

// Seed ~2 h of history so charts/reports are populated on first launch.
function seed() {
  if (state.readings.length) return;
  const th = state.thresholds, d = state.device, s = state.sim;
  const N = 1400;
  let hum = 89, temp = 27.5, soil = 74;
  for (let i = N; i > 0; i--) {
    const ts = new Date(Date.now() - i * SAMPLE_INTERVAL_SEC * 1000).toISOString();
    hum += (88.5 - hum) * 0.06 + (d.pumpOn ? 0.7 : 0) + jitter(0.5);
    if (Math.random() < 0.012) hum -= 3.5;
    hum = Math.max(80, Math.min(95, hum));
    temp += (27.2 - temp) * 0.06 - (d.fanOn ? 0.5 : 0) + jitter(0.4);
    if (Math.random() < 0.01) temp += 3.6;
    temp = Math.max(24.5, Math.min(33, temp));
    soil += (73 - soil) * 0.05 + (d.pumpOn ? 0.3 : 0) + jitter(0.5);
    soil = Math.max(62, Math.min(80, soil));
    // feed as a raw sample (also advances EWMA + actuation + alerts)
    processSample(
      { humidity: [hum, hum + jitter(1), hum - jitter(1)].map((v) => round(v)), temperature: [temp, temp + jitter(0.5), temp - jitter(0.5)].map((v) => round(v)), soil: [Math.round(soil), Math.round(soil - 1)], light: Math.round(600 + Math.random() * 400) },
      ts
    );
  }
}

function ensureStarted() {
  if (state.started) return;
  state.started = true;
  seed();
  setInterval(tick, SAMPLE_INTERVAL_SEC * 1000);
}

// ---- label helpers (match backend) ----
const labelTemp = (v, th) => (v > th.tempMax ? "High" : v >= 24 ? "Optimal" : "Low");
const labelHum = (v, th) => (v >= 90 ? "Excellent" : v >= th.humidityMin ? "Good" : "Low");
const labelSoil = (v, th) => (v >= th.soilMin + 10 ? "Good" : v >= th.soilMin ? "Fair" : "Dry");
const hhmm = (ts) => new Date(ts).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });

function downsample(rows, target) {
  if (rows.length <= target) return rows;
  const step = rows.length / target;
  const out = [];
  for (let i = 0; i < target; i++) out.push(rows[Math.floor(i * step)]);
  out.push(rows[rows.length - 1]);
  return out;
}

function runtimeMin(actuator) {
  const dayAgo = Date.now() - 86400e3;
  const evs = state.events.filter((e) => e.actuator === actuator && new Date(e.ts).getTime() >= dayAgo).sort((a, b) => new Date(a.ts) - new Date(b.ts));
  let ms = 0, onAt = null;
  for (const e of evs) {
    if (e.state === "ON") onAt = new Date(e.ts);
    else if (e.state === "OFF" && onAt) { ms += new Date(e.ts) - onAt; onAt = null; }
  }
  if (onAt) ms += Date.now() - onAt;
  return Math.round(ms / 60000);
}

// ---- public API (mirrors src/api/client.js) ----
export const localApi = {
  async login(phone) {
    ensureStarted();
    state.user = { id: "user_local", phone, name: phone === "08030000000" ? "Farmer Adeyemi" : "Farmer", smsNumber: phone || "+2348030000000", language: "English" };
    return state.user;
  },
  async register(phone, _password, name) {
    ensureStarted();
    state.user = { id: "user_local", phone, name: name || "Farmer", smsNumber: phone, language: "English" };
    return state.user;
  },
  async me() { return state.user; },
  async logout() { state.user = null; },

  async latest() {
    ensureStarted();
    const th = state.thresholds;
    const latest = state.readings[state.readings.length - 1] || null;
    const recent = state.readings.slice(-720);
    const compliant = recent.filter((r) => r.status === "NOMINAL").length;
    const health = recent.length ? Math.round((compliant / recent.length) * 100) : 100;
    return {
      device: state.device,
      thresholds: th,
      latest,
      summary: {
        health, seedlings: state.device.seedlings, uptime: 99.4, status: latest?.status || "NOMINAL",
        environment: latest
          ? [
              { key: "temp", label: "Temperature", value: latest.temp, unit: "°C", status: labelTemp(latest.temp, th) },
              { key: "humidity", label: "Humidity", value: latest.humidity, unit: "%", status: labelHum(latest.humidity, th) },
              { key: "soil", label: "Soil Moisture", value: latest.soil, unit: "%", status: labelSoil(latest.soil, th) },
              { key: "light", label: "Light", value: latest.light ?? 0, unit: " Lux", status: "Bright" },
            ]
          : [],
      },
    };
  },

  async trend(window = "1h", points = 24) {
    ensureStarted();
    const now = Date.now();
    const spanMs = { "1h": 3600e3, "24h": 24 * 3600e3, "7d": 7 * 24 * 3600e3 }[window] || 3600e3;
    const rows = state.readings.filter((r) => now - new Date(r.ts).getTime() <= spanMs);
    const series = downsample(rows, points).map((r) => ({ t: hhmm(r.ts), ts: r.ts, temp: r.temp, hum: r.humidity, soil: r.soil }));
    return { window, series };
  },

  async deviceStatus() {
    ensureStarted();
    const d = state.device;
    return {
      device: d,
      rows: [
        { key: "pump", label: "Misting Pump", state: d.pumpOn ? "ON" : "OFF", on: d.pumpOn },
        { key: "fan", label: "Cooling Fan", state: d.fanOn ? "ON" : "OFF", on: d.fanOn },
        { key: "wifi", label: "WiFi", state: "Connected", on: true },
        { key: "cloud", label: "Cloud Sync", state: "Local", on: true },
        { key: "sms", label: "SMS Gateway", state: "Ready", on: true },
      ],
    };
  },

  async alerts(limit = 30) {
    ensureStarted();
    const all = state.alerts.slice().sort((a, b) => new Date(b.ts) - new Date(a.ts));
    const limited = all.slice(0, limit).map((a) => ({ ...a, icon: ICONS[a.level] || "Activity", time: hhmm(a.ts) }));
    const counts = { Critical: 0, Warning: 0, Resolved: 0 };
    for (const a of all) if (counts[a.level] != null) counts[a.level]++;
    return { alerts: limited, counts };
  },

  async ackAlert(id) {
    const a = state.alerts.find((x) => x.id === id);
    if (a) { a.acknowledged = true; a.acknowledgedAt = new Date().toISOString(); }
    return { ok: true, responseLatencyMs: 0 };
  },

  async reportSummary() {
    ensureStarted();
    const th = state.thresholds, r = state.readings, ev = state.events, al = state.alerts;
    const n = r.length || 1;
    const compliant = r.filter((x) => x.humidity > th.humidityMin && x.temp < th.tempMax).length;
    const compliance = Math.round((compliant / n) * 100);
    const water = r.reduce((s, x) => s + (x.waterDeltaL || 0), 0);
    const pumpActivations = ev.filter((e) => e.actuator === "pump" && e.state === "ON").length;
    const avg = (k) => r.reduce((s, x) => s + x[k], 0) / n;
    const daysMonitored = r.length ? Math.max(1, Math.ceil((Date.now() - new Date(r[0].ts)) / 86400e3)) : 0;
    const dayAgo = Date.now() - 86400e3;
    const recent = r.filter((x) => new Date(x.ts).getTime() >= dayAgo);
    const waterToday = recent.reduce((s, x) => s + (x.waterDeltaL || 0), 0);
    const healthToday = recent.length ? Math.round((recent.filter((x) => x.status === "NOMINAL").length / recent.length) * 100) : 100;
    return {
      device: state.device,
      cycle: { number: 4, daysMonitored },
      today: { waterUsed: `${waterToday.toFixed(0)} L`, pumpRuntime: `${runtimeMin("pump")} min`, fanRuntime: `${runtimeMin("fan")} min`, healthScore: `${healthToday}%` },
      metrics: [
        { key: "compliance", label: "Compliance percentage", value: `${compliance}%` },
        { key: "alerts", label: "Total alerts", value: String(al.length) },
        { key: "water", label: "Total water consumption", value: `${water.toFixed(0)} L` },
        { key: "pump", label: "Total pump activations", value: String(pumpActivations) },
        { key: "avgHum", label: "Average humidity", value: `${avg("humidity").toFixed(1)}%` },
        { key: "avgTemp", label: "Average temperature", value: `${avg("temp").toFixed(1)}°C` },
        { key: "avgSoil", label: "Average soil moisture", value: `${avg("soil").toFixed(0)}%` },
      ],
      compliance,
    };
  },

  async waterSeries() {
    ensureStarted();
    const labels = ["M", "T", "W", "T", "F", "S", "S"];
    const buckets = new Array(7).fill(0);
    const now = new Date();
    for (const r of state.readings) {
      const daysAgo = Math.floor((now - new Date(r.ts)) / 86400e3);
      if (daysAgo >= 0 && daysAgo < 7) buckets[6 - daysAgo] += r.waterDeltaL || 0;
    }
    return { series: buckets.map((l, i) => ({ d: labels[i], l: Math.round(l) })) };
  },

  async settings() {
    ensureStarted();
    return {
      thresholds: state.thresholds,
      system: { smsNumber: state.user?.smsNumber || "+2348030000000", language: state.user?.language || "English", cloudConnection: "Local", firmware: state.device.firmware },
    };
  },
  async updateThresholds(patch) {
    for (const k of ["humidityMin", "humidityRelease", "tempMax", "tempRelease", "soilMin"]) {
      if (patch[k] != null && Number.isFinite(Number(patch[k]))) state.thresholds[k] = Number(patch[k]);
    }
    return { thresholds: state.thresholds };
  },
  async updateSystem(patch) {
    if (state.user) {
      if (patch.smsNumber) state.user.smsNumber = String(patch.smsNumber);
      if (patch.language) state.user.language = String(patch.language);
    }
    return { user: state.user };
  },

  async smsPreview() {
    ensureStarted();
    const th = state.thresholds;
    const breach = state.alerts.filter((a) => a.level === "Critical").sort((a, b) => new Date(b.ts) - new Date(a.ts))[0];
    const value = breach?.value ?? 81;
    const time = breach ? new Date(breach.ts) : new Date();
    return {
      fields: [
        { k: "Tunnel", v: "A" },
        { k: "Humidity", v: `${value}%` },
        { k: "Threshold", v: `${th.humidityMin}%` },
        { k: "Action", v: "Pump activated" },
        { k: "Time", v: hhmm(time) },
      ],
      raw: `SMART CASSAVA NURSERY\nTunnel: Tunnel A\nHumidity: ${value}%\nThreshold: ${th.humidityMin}%\nAction: Pump activated\nTime: ${time.toLocaleTimeString("en-GB")}`,
      channel: "SIM800L",
    };
  },

  async architecture() {
    return {
      flow: "Sensors → ESP32 → Cloud → App → Farmer",
      components: [
        { label: "Rooting tunnel", role: "Perception" },
        { label: "ESP32 controller", role: "Perception/Compute" },
        { label: "Relay module", role: "Perception" },
        { label: "Water pump", role: "Actuation" },
        { label: "Cooling fan", role: "Actuation" },
        { label: "SIM800L GSM", role: "Network" },
        { label: "Cloud database", role: "Application" },
        { label: "React Native app", role: "End-User" },
      ],
      pipeline: ["Sense", "Process", "Sync", "Notify", "Act"],
    };
  },

  // Certification export text for local-mode Share (no server to hit).
  certificationText(format = "csv") {
    ensureStarted();
    const rows = state.readings.slice(-300); // trim for shareable size
    if (format === "csv") {
      const header = "server_ts,device_ts,tunnel,temp_c,humidity_pct,soil_pct,light_lux,status,pump,fan";
      const body = rows.map((r) => [r.ts, r.deviceTs, state.device.tunnel, r.temp, r.humidity, r.soil, r.light ?? "", r.status, r.pumpOn ? 1 : 0, r.fanOn ? 1 : 0].join(",")).join("\n");
      return `${header}\n${body}`;
    }
    return JSON.stringify({ device: state.device, thresholds: state.thresholds, recordCount: state.readings.length, sample: rows.slice(-50) }, null, 2);
  },

  // Live subscription (replaces the WebSocket in local mode).
  subscribeLive(cb) {
    ensureStarted();
    state.listeners.add(cb);
    return () => state.listeners.delete(cb);
  },
};
