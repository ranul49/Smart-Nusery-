import React, { useEffect, useRef, useState } from "react";
import { View, Text } from "react-native";
import { Activity } from "lucide-react-native";
import { C } from "../theme/tokens.js";
import { Card, Pill, SectionLabel, Screen, SubHeader, Notice } from "../components/ui.js";
import { Gauge270 } from "../components/Gauge270.js";
import { AreaChartMini, AxisLabels } from "../components/charts.js";
import { api } from "../api/client.js";

export function Live({ onBack, live }) {
  const [reading, setReading] = useState(null);
  const [thresholds, setThresholds] = useState(null);
  const [trend, setTrend] = useState([]);
  const [ago, setAgo] = useState(0);
  const lastTs = useRef(null);

  // Seed from REST, then let the live WebSocket reading take over.
  useEffect(() => {
    api.latest().then((d) => { setReading(d.latest); setThresholds(d.thresholds); }).catch(() => {});
    api.trend("1h", 12).then((d) => setTrend(d.series)).catch(() => {});
    const id = setInterval(() => api.trend("1h", 12).then((d) => setTrend(d.series)).catch(() => {}), 15000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    if (live) {
      setReading(live);
      lastTs.current = Date.now();
      setAgo(0);
    }
  }, [live]);

  useEffect(() => {
    const t = setInterval(() => setAgo((a) => a + 1), 1000);
    return () => clearInterval(t);
  }, []);

  if (!reading) {
    return (
      <Screen header={<SubHeader title="Live Monitoring" onBack={onBack} />}>
        <Notice text="Connecting to live feed…" />
      </Screen>
    );
  }

  return (
    <Screen header={<SubHeader title="Live Monitoring" onBack={onBack} />}>
      <Card style={{ alignItems: "center", padding: 22 }}>
        <Gauge270 value={reading.temp} min={15} max={40} unit="°C" label="Temperature" color={C.amber} size={170}
          zoneMin={24} zoneMax={thresholds?.tempMax ?? 30} />
        <View style={{ marginTop: 14 }}>
          <Pill text={`Optimal range 24–${thresholds?.tempMax ?? 30}°C`} color={C.amber} bg={C.amberSoft} />
        </View>
      </Card>

      <View style={{ flexDirection: "row", gap: 12, marginTop: 12 }}>
        <Card style={{ flex: 1, alignItems: "center", padding: 16 }}>
          <Gauge270 value={reading.humidity} min={60} max={100} unit="%" label="Humidity" color={C.blue}
            zoneMin={thresholds?.humidityMin ?? 85} zoneMax={100} />
        </Card>
        <Card style={{ flex: 1, alignItems: "center", padding: 16 }}>
          <Gauge270 value={reading.soil} min={40} max={100} unit="%" label="Soil Moist." color={C.green}
            zoneMin={thresholds?.soilMin ?? 60} zoneMax={100} />
        </Card>
      </View>

      <Card style={{ marginTop: 12, flexDirection: "row", alignItems: "center", gap: 10 }}>
        <Activity size={18} color={C.green} />
        <Text style={{ fontSize: 13, color: C.inkSoft, flex: 1 }}>
          Last updated: <Text style={{ color: C.ink, fontWeight: "700" }}>{ago < 2 ? "Just now" : `${ago}s ago`}</Text> · refresh every 5s
        </Text>
        <View style={{ width: 9, height: 9, borderRadius: 5, backgroundColor: C.greenLight }} />
      </Card>

      <SectionLabel>Last 12 readings</SectionLabel>
      <Card style={{ paddingLeft: 4 }}>
        {trend.length > 1 ? (
          <>
            <AreaChartMini data={trend} dataKey="hum" color={C.green} />
            <AxisLabels data={trend} keyName="t" every={2} />
          </>
        ) : (
          <Notice text="Gathering readings…" />
        )}
      </Card>
    </Screen>
  );
}
