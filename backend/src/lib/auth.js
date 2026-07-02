import jwt from "jsonwebtoken";
import { config } from "../config.js";
import { db } from "./store.js";

export function signToken(user) {
  return jwt.sign({ sub: user.id, phone: user.phone }, config.jwtSecret, {
    expiresIn: config.jwtExpiresIn,
  });
}

// Express middleware — requires a valid Bearer token and loads req.user.
export function requireAuth(req, res, next) {
  const header = req.headers.authorization || "";
  // Accept a Bearer header, or a ?token= query param for browser download links.
  const token = header.startsWith("Bearer ") ? header.slice(7) : req.query.token || null;
  if (!token) return res.status(401).json({ error: "Authentication required" });
  try {
    const payload = jwt.verify(token, config.jwtSecret);
    const user = db.users.findOne((u) => u.id === payload.sub);
    if (!user) return res.status(401).json({ error: "User no longer exists" });
    req.user = user;
    next();
  } catch {
    return res.status(401).json({ error: "Invalid or expired token" });
  }
}

// Express middleware — authenticates an ESP32 field node via shared API key.
export function requireDeviceKey(req, res, next) {
  const key = req.headers["x-device-key"] || req.query.key;
  if (key !== config.deviceApiKey) {
    return res.status(401).json({ error: "Invalid device key" });
  }
  next();
}

export function publicUser(user) {
  if (!user) return null;
  const { passwordHash, ...rest } = user;
  return rest;
}
