import { WebSocketServer } from "ws";
import jwt from "jsonwebtoken";
import { config } from "../config.js";
import { db } from "./store.js";
import { bus, EVENTS } from "./bus.js";

/*
 * Real-time push channel. The app opens ws://host/ws?token=JWT and receives
 * live "reading", "alert" and "actuator" messages for the devices it owns —
 * driving the live gauges and the critical-alert toast without polling.
 */
export function attachWebSocket(server) {
  const wss = new WebSocketServer({ server, path: "/ws" });

  wss.on("connection", (socket, req) => {
    const url = new URL(req.url, "http://localhost");
    const token = url.searchParams.get("token");
    let userId = null;
    try {
      userId = jwt.verify(token, config.jwtSecret).sub;
    } catch {
      socket.close(4001, "Invalid token");
      return;
    }

    const ownsDevice = (deviceId) => {
      const d = db.devices.findOne((x) => x.id === deviceId);
      return d && d.ownerId === userId;
    };

    const send = (type) => (payload) => {
      if (payload.deviceId && !ownsDevice(payload.deviceId)) return;
      if (socket.readyState === socket.OPEN) {
        socket.send(JSON.stringify({ type, payload }));
      }
    };

    const onReading = send(EVENTS.READING);
    const onAlert = send(EVENTS.ALERT);
    const onActuator = send(EVENTS.ACTUATOR);
    bus.on(EVENTS.READING, onReading);
    bus.on(EVENTS.ALERT, onAlert);
    bus.on(EVENTS.ACTUATOR, onActuator);

    socket.on("close", () => {
      bus.off(EVENTS.READING, onReading);
      bus.off(EVENTS.ALERT, onAlert);
      bus.off(EVENTS.ACTUATOR, onActuator);
    });

    socket.send(JSON.stringify({ type: "connected", payload: { ok: true } }));
  });

  return wss;
}
