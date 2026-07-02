import React, { useEffect, useState } from "react";
import { View, Text, Pressable, ScrollView } from "react-native";
import { BarChart3, Download } from "lucide-react-native";
import { C } from "../theme/tokens.js";
import { Card, SectionLabel, PageTitle, PrimaryButton, Screen, Notice } from "../components/ui.js";
import { LineChartMini, BarChartMini, AxisLabels } from "../components/charts.js";
import { api } from "../api/client.js";

const RANGES = [
  { label: "Today", window: "1h" },
  { label: "Week", window: "24h" },
  { label: "Month", window: "7d" },
  { label: "Growth Cycle", window: "7d" },
];

export function Analytics() {
  const [range, setRange] = useState(RANGES[0]);
  const [series, setSeries] = useState([]);
  const [water, setWater] = useState([]);
  const [compliance, setCompliance] = useState(null);

  useEffect(() => {
    api.trend(range.window, 24).then((d) => setSeries(d.series)).catch(() => {});
  }, [range]);

  useEffect(() => {
    api.waterSeries().then((d) => setWater(d.series)).catch(() => {});
    api.reportSummary().then((d) => setCompliance(d.compliance)).catch(() => {});
  }, []);

  return (
    <Screen>
      <PageTitle title="Analytics" sub="Microclimate performance" icon={<BarChart3 size={24} color={C.blue} />} bg={C.blueSoft} />

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, marginBottom: 4 }}>
        {RANGES.map((r) => {
          const active = r.label === range.label;
          return (
            <Pressable key={r.label} onPress={() => setRange(r)} style={{ paddingVertical: 8, paddingHorizontal: 15, borderRadius: 20, backgroundColor: active ? C.green : C.surface, borderWidth: active ? 0 : 1, borderColor: C.line }}>
              <Text style={{ fontSize: 13, fontWeight: "600", color: active ? "#fff" : C.inkSoft }}>{r.label}</Text>
            </Pressable>
          );
        })}
      </ScrollView>

      <ChartBlock title="Temperature over time" data={series} dataKey="temp" color={C.amber} />
      <ChartBlock title="Humidity trend" data={series} dataKey="hum" color={C.blue} />
      <ChartBlock title="Soil moisture trend" data={series} dataKey="soil" color={C.green} />

      <SectionLabel>Water consumption (7 days)</SectionLabel>
      <Card style={{ paddingLeft: 4 }}>
        {water.length ? (
          <>
            <BarChartMini data={water} dataKey="l" color={C.blue} />
            <AxisLabels data={water} keyName="d" every={1} />
          </>
        ) : (
          <Notice text="No water data yet" />
        )}
      </Card>

      <Card style={{ marginTop: 12, flexDirection: "row", alignItems: "center", justifyContent: "space-between", backgroundColor: C.greenSoft }}>
        <View>
          <Text style={{ fontSize: 15, fontWeight: "800", color: C.green }}>Microclimate Compliance</Text>
          <Text style={{ fontSize: 12, color: C.inkSoft, marginTop: 2 }}>Within target {range.label.toLowerCase()}</Text>
        </View>
        <Text style={{ fontSize: 30, fontWeight: "800", color: C.green }}>{compliance != null ? `${compliance}%` : "—"}</Text>
      </Card>

      <PrimaryButton label="Export Report" icon={<Download size={18} color="#fff" />} color={C.blue} onPress={() => {}} style={{ marginTop: 16 }} />
    </Screen>
  );
}

function ChartBlock({ title, data, dataKey, color }) {
  return (
    <>
      <SectionLabel>{title}</SectionLabel>
      <Card style={{ paddingLeft: 4 }}>
        {data.length > 1 ? (
          <>
            <LineChartMini data={data} dataKey={dataKey} color={color} />
            <AxisLabels data={data} keyName="t" every={4} />
          </>
        ) : (
          <Notice text="Gathering data…" />
        )}
      </Card>
    </>
  );
}
