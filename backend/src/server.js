import http from "node:http";
import express from "express";
import cors from "cors";
import { config } from "./config.js";
import { db } from "./lib/store.js";
import { attachWebSocket } from "./lib/ws.js";
import { startSimulator } from "./lib/simulator.js";
import { startThinger } from "./lib/thinger.js";
import { ensureDemo } from "./lib/ensureSeed.js";

import authRoutes from "./routes/auth.js";
import deviceRoutes from "./routes/devices.js";
import readingRoutes from "./routes/readings.js";
import alertRoutes from "./routes/alerts.js";
import reportRoutes from "./routes/reports.js";
import settingsRoutes from "./routes/settings.js";
import certificationRoutes from "./routes/certification.js";
import ingestRoutes from "./routes/ingest.js";
import miscRoutes from "./routes/misc.js";

const app = express();
app.use(cors());
app.use(express.json({ limit: "256kb" }));

// Simple request log
app.use((req, _res, next) => {
  if (req.path !== "/api/health") console.log(`${req.method} ${req.path}`);
  next();
});

app.get("/api/health", (_req, res) => {
  res.json({ ok: true, service: "smart-cassava-nursery", time: new Date().toISOString() });
});

app.use("/api/auth", authRoutes);
app.use("/api/devices", deviceRoutes);
app.use("/api/readings", readingRoutes);
app.use("/api/alerts", alertRoutes);
app.use("/api/reports", reportRoutes);
app.use("/api/settings", settingsRoutes);
app.use("/api/certification", certificationRoutes);
app.use("/api/ingest", ingestRoutes);
app.use("/api", miscRoutes);

// 404 + error handlers
app.use((req, res) => res.status(404).json({ error: `Not found: ${req.method} ${req.path}` }));
app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(500).json({ error: "Internal server error" });
});

const server = http.createServer(app);
attachWebSocket(server);

server.listen(config.port, config.host, async () => {
  console.log(`\nSmart Cassava Nursery backend — Project SEN-20-5112`);
  console.log(`  REST API   : http://${config.host}:${config.port}/api`);
  console.log(`  WebSocket  : ws://${config.host}:${config.port}/ws`);
  console.log(`  Data source: ${config.dataSource}`);

  await ensureDemo(); // guarantee a login exists on a fresh cloud instance

  // Choose the live data source. "ingest" needs no starter — it just waits for
  // the ESP32 to POST to /api/ingest.
  if (config.dataSource === "thinger") startThinger();
  else if (config.dataSource === "simulator") startSimulator();
});

// Persist buckets on shutdown so nothing is lost.
function shutdown() {
  console.log("\nFlushing data buckets…");
  db.flushAll();
  process.exit(0);
}
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
