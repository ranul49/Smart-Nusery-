import { useEffect, useRef, useState } from "react";
import { WS_BASE, LOCAL_MODE } from "./config.js";
import { getToken } from "./client.js";
import { localApi } from "./local.js";

/*
 * Subscribes to live readings + alerts. In local mode it listens to the
 * on-device engine; otherwise it opens the backend WebSocket (auto-reconnecting
 * if the socket drops). Powers the live gauges and the critical-alert toast.
 */
export function useLive() {
  const [reading, setReading] = useState(null);
  const [alert, setAlert] = useState(null);
  const socketRef = useRef(null);
  const retryRef = useRef(null);

  useEffect(() => {
    // Local mode: subscribe directly to the on-device data engine.
    if (LOCAL_MODE) {
      const unsub = localApi.subscribeLive((type, payload) => {
        if (type === "reading") setReading(payload);
        else if (type === "alert") setAlert({ ...payload, _rx: Date.now() });
      });
      return unsub;
    }

    let closed = false;

    function connect() {
      const token = getToken();
      if (!token) return;
      const ws = new WebSocket(`${WS_BASE}/ws?token=${encodeURIComponent(token)}`);
      socketRef.current = ws;

      ws.onmessage = (evt) => {
        try {
          const msg = JSON.parse(evt.data);
          if (msg.type === "reading") setReading(msg.payload);
          else if (msg.type === "alert") setAlert({ ...msg.payload, _rx: Date.now() });
        } catch {
          /* ignore malformed frames */
        }
      };

      ws.onclose = () => {
        if (!closed) retryRef.current = setTimeout(connect, 2500);
      };
      ws.onerror = () => ws.close();
    }

    connect();
    return () => {
      closed = true;
      clearTimeout(retryRef.current);
      socketRef.current?.close();
    };
  }, []);

  return { reading, alert };
}
