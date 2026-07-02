import { config } from "../config.js";

/*
 * Last-mile farmer alerting (Chapter 3.5.2 / 3.8.2).
 *
 * On a real node the ESP32 dispatches the SMS directly through the SIM800L's
 * AT+CMGS command. In this cloud-application layer we mirror that behaviour with
 * Twilio as the cloud-initiated backup path. When no Twilio credentials are
 * configured the message is logged to the console so the whole pipeline still
 * runs end-to-end with zero external accounts (useful for demos and marking).
 */

let client = null;
let attemptedInit = false;

async function getClient() {
  if (attemptedInit) return client;
  attemptedInit = true;
  const { accountSid, authToken } = config.twilio;
  if (!accountSid || !authToken) return null;
  try {
    const { default: twilio } = await import("twilio");
    client = twilio(accountSid, authToken);
  } catch {
    client = null; // twilio package not installed — fall back to console.
  }
  return client;
}

/*
 * Formats an alert exactly as Chapter 3.6.4 specifies: tunnel identifier,
 * breaching variable, current measured value, threshold value, and the
 * actuation response taken. Mirrors the SMS preview screen in the app.
 */
export function formatAlertSms({ tunnel, variable, value, unit, threshold, action, time }) {
  return [
    "SMART CASSAVA NURSERY",
    `Tunnel: ${tunnel}`,
    `${variable}: ${value}${unit}`,
    `Threshold: ${threshold}${unit}`,
    `Action: ${action}`,
    `Time: ${time}`,
  ].join("\n");
}

export async function sendSms(toNumber, body) {
  const c = await getClient();
  if (!c || !config.twilio.fromNumber) {
    console.log(`\n[SMS → ${toNumber}]\n${body}\n`);
    return { delivered: false, channel: "console" };
  }
  try {
    await c.messages.create({ to: toNumber, from: config.twilio.fromNumber, body });
    return { delivered: true, channel: "twilio" };
  } catch (err) {
    console.error("[SMS] Twilio send failed, logged to console instead:", err.message);
    console.log(`\n[SMS → ${toNumber}]\n${body}\n`);
    return { delivered: false, channel: "console", error: err.message };
  }
}
