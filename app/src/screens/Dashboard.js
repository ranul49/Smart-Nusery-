import React, { useCallback, useEffect, useState } from "react";
import { View, Text } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import {
  Leaf, Thermometer, Droplets, Sprout, Sun, Waves, Fan, Wifi, Cloud,
  MessageSquare, Gauge, RadioTower, WifiOff,
} from "lucide-react-native";
import { C, cardShadow } from "../theme/tokens.js";
import { Card, Pill, SectionLabel, PrimaryButton, OutlineButton, Screen, Notice } from "../components/ui.js";
import { api } from "../api/client.js";

const ENV_ICONS = { temp: Thermometer, humidity: Droplets, soil: Sprout, light: Sun };
const ENV_STYLE = {
  temp: { c: C.amber, bg: C.amberSoft },
  humidity: { c: C.blue, bg: C.blueSoft },
  soil: { c: C.green, bg: C.greenSoft },
  light: { c: "#E9A100", bg: "#FFF8E1" },
};
const DEV_ICONS = { pump: Waves, fan: Fan, wifi: Wifi, cloud: Cloud, sms: MessageSquare };

export function Dashboard({ user, live, connected = true, onOpenLive, onOpenSystem }) {
  const [data, setData] = useState(null);
  const [status, setStatus] = useState(null);
  const [today, setToday] = useState(null);
  const [error, setError] = useState("");
  const [updatedAt, setUpdatedAt] = useState(null);
  const [now, setNow] = useState(Date.now());

  const load = useCallback(async () => {
    try {
      const [latest, st, report] = await Promise.all([api.latest(), api.deviceStatus(), api.reportSummary()]);
      setData(latest);
      setStatus(st);
      setToday(report.today);
      setUpdatedAt(Date.now());
      setError("");
    } catch (e) {
      setError(e.message);
    }
  }, []);

  useEffect(() => {
    load();
    const id = setInterval(load, 6000);
    return () => clearInterval(id);
  }, [load]);

  // Tick once a second so the "updated Xs ago" line and staleness stay current.
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  if (!data) return <Screen><Notice text={error || "Loading nursery…"} /></Screen>;

  // Live-pushed readings keep this fresher than the 6s poll; treat data as stale
  // if the socket is down, the last poll errored, or nothing has updated recently.
  const liveTs = live?.ts ? new Date(live.ts).getTime() : 0;
  const freshestTs = Math.max(updatedAt || 0, liveTs);
  const secsAgo = freshestTs ? Math.floor((now - freshestTs) / 1000) : null;
  const stale = !connected || !!error || (secsAgo != null && secsAgo > 20);
  const agoText = secsAgo == null ? "—" : secsAgo < 2 ? "just now" : `${secsAgo}s ago`;

  const summary = data.summary;
  // Prefer the live-pushed reading for the environment cards when available.
  const env = summary.environment.map((e) => {
    if (!live) return e;
    if (e.key === "temp") return { ...e, value: live.temp };
    if (e.key === "humidity") return { ...e, value: live.humidity };
    if (e.key === "soil") return { ...e, value: live.soil };
    if (e.key === "light" && live.light != null) return { ...e, value: live.light };
    return e;
  });

  const healthy = summary.status === "NOMINAL";

  return (
    <Screen>
      {/* stale-data / reconnecting banner */}
      {stale && (
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: C.amberSoft, borderRadius: 12, borderWidth: 1, borderColor: `${C.amber}55`, paddingVertical: 9, paddingHorizontal: 12, marginBottom: 14 }}>
          <WifiOff size={16} color={C.amber} />
          <Text style={{ flex: 1, fontSize: 12.5, color: C.amber, fontWeight: "600" }}>
            {connected ? "Data may be stale" : "Reconnecting…"} · last update {agoText}
          </Text>
        </View>
      )}

      {/* greeting */}
      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 18 }}>
        <View>
          <Text style={{ fontSize: 13, color: C.inkSoft }}>Good morning,</Text>
          <Text style={{ fontSize: 22, fontWeight: "800", color: C.ink }}>{user?.name || "Farmer"} 👋</Text>
          <Text style={{ fontSize: 11, color: stale ? C.amber : C.inkSoft, marginTop: 3 }}>Updated {agoText}</Text>
        </View>
        <View style={{ width: 44, height: 44, borderRadius: 14, backgroundColor: C.greenSoft, alignItems: "center", justifyContent: "center" }}>
          <Leaf size={22} color={C.green} />
        </View>
      </View>

      {/* status hero */}
      <LinearGradient colors={[C.green, C.greenDark]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ borderRadius: 20, padding: 20, ...cardShadow }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
          <View style={{ width: 12, height: 12, borderRadius: 6, backgroundColor: healthy ? "#A5F3A0" : "#FFD9A0" }} />
          <Text style={{ fontSize: 13, color: "rgba(255,255,255,0.9)" }}>System Status</Text>
        </View>
        <Text style={{ fontSize: 26, fontWeight: "800", color: "#fff", marginTop: 6 }}>
          {healthy ? "Nursery Healthy" : summary.status === "APPROACH" ? "Watch Conditions" : "Action Needed"}
        </Text>
        <View style={{ flexDirection: "row", gap: 22, marginTop: 16 }}>
          <Mini k="Health" v={`${summary.health}%`} />
          <Mini k="Seedlings" v={String(summary.seedlings)} />
          <Mini k="Uptime" v={`${summary.uptime}%`} />
        </View>
      </LinearGradient>

      <SectionLabel>Environment</SectionLabel>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 12 }}>
        {env.map((e) => {
          const I = ENV_ICONS[e.key] || Thermometer;
          const s = ENV_STYLE[e.key] || { c: C.green, bg: C.greenSoft };
          return (
            <Card key={e.key} style={{ width: "47%", padding: 15 }}>
              <View style={{ width: 38, height: 38, borderRadius: 12, backgroundColor: s.bg, alignItems: "center", justifyContent: "center" }}>
                <I size={20} color={s.c} />
              </View>
              <Text style={{ fontSize: 22, fontWeight: "800", color: C.ink, marginTop: 12 }}>
                {e.value}{e.unit}
              </Text>
              <Text style={{ fontSize: 12, color: C.inkSoft, marginTop: 2 }}>{e.label}</Text>
              <View style={{ marginTop: 9 }}>
                <Pill text={e.status} color={s.c} bg={s.bg} />
              </View>
            </Card>
          );
        })}
      </View>

      <SectionLabel>Device Status</SectionLabel>
      <Card style={{ padding: 6 }}>
        {status?.rows.map((r, i) => {
          const I = DEV_ICONS[r.key] || Wifi;
          const last = i === status.rows.length - 1;
          return (
            <View key={r.key} style={{ flexDirection: "row", alignItems: "center", paddingVertical: 13, paddingHorizontal: 12, borderBottomWidth: last ? 0 : 1, borderBottomColor: C.line }}>
              <View style={{ width: 34, height: 34, borderRadius: 10, backgroundColor: r.on ? C.greenSoft : "#F1F2F0", alignItems: "center", justifyContent: "center" }}>
                <I size={18} color={r.on ? C.green : C.inkSoft} />
              </View>
              <Text style={{ flex: 1, marginLeft: 12, fontSize: 14, color: C.ink, fontWeight: "500" }}>{r.label}</Text>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 7 }}>
                <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: r.on ? C.greenLight : "#C4CABF" }} />
                <Text style={{ fontSize: 13, fontWeight: "600", color: r.on ? C.green : C.inkSoft }}>{r.state}</Text>
              </View>
            </View>
          );
        })}
      </Card>

      <SectionLabel>Today's Statistics</SectionLabel>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 12 }}>
        <Stat label="Water Used" val={today?.waterUsed ?? "—"} />
        <Stat label="Pump Runtime" val={today?.pumpRuntime ?? "—"} />
        <Stat label="Fan Runtime" val={today?.fanRuntime ?? "—"} />
        <Stat label="Health Score" val={today?.healthScore ?? "—"} hi />
      </View>

      <PrimaryButton label="Open Live Monitoring" icon={<Gauge size={18} color="#fff" />} onPress={onOpenLive} style={{ marginTop: 18 }} />
      <OutlineButton label="View System Architecture" icon={<RadioTower size={18} color={C.soil} />} color={C.soil} onPress={onOpenSystem} style={{ marginTop: 10 }} />
    </Screen>
  );
}

function Mini({ k, v }) {
  return (
    <View>
      <Text style={{ fontSize: 19, fontWeight: "800", color: "#fff" }}>{v}</Text>
      <Text style={{ fontSize: 11, color: "rgba(255,255,255,0.8)" }}>{k}</Text>
    </View>
  );
}
function Stat({ label, val, hi }) {
  return (
    <Card style={{ width: "47%", padding: 15, backgroundColor: hi ? C.greenSoft : C.surface }}>
      <Text style={{ fontSize: 24, fontWeight: "800", color: hi ? C.green : C.ink }}>{val}</Text>
      <Text style={{ fontSize: 12, color: C.inkSoft, marginTop: 3 }}>{label}</Text>
    </Card>
  );
}
