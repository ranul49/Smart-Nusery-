import React, { useEffect, useState } from "react";
import { View, Text, Linking, Share } from "react-native";
import { FileText, ShieldCheck, Download } from "lucide-react-native";
import { C } from "../theme/tokens.js";
import { Card, SectionLabel, PageTitle, PrimaryButton, OutlineButton, Screen, Notice } from "../components/ui.js";
import { LinearGradient } from "expo-linear-gradient";
import { api, getToken } from "../api/client.js";
import { API_BASE, LOCAL_MODE } from "../api/config.js";

export function Reports() {
  const [report, setReport] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    api.reportSummary().then(setReport).catch((e) => setError(e.message));
  }, []);

  const openExport = (format) => {
    if (LOCAL_MODE) {
      // No server to hit — build the certification export on-device and share it.
      Share.share({ title: `certification-${format}`, message: api.certificationText(format) }).catch(() => {});
      return;
    }
    const token = getToken();
    Linking.openURL(`${API_BASE}/api/certification/export?format=${format}&token=${token}`).catch(() => {});
  };

  if (!report) return <Screen><Notice text={error || "Building report…"} /></Screen>;

  return (
    <Screen>
      <PageTitle title="Reports" sub="Growth-cycle summary" icon={<FileText size={24} color={C.soil} />} bg={C.soilSoft} />

      <LinearGradient colors={[C.soil, "#6D4C41"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ borderRadius: 20, padding: 16, flexDirection: "row", alignItems: "center", gap: 14 }}>
        <ShieldCheck size={36} color="#fff" />
        <View>
          <Text style={{ fontSize: 16, fontWeight: "800", color: "#fff" }}>Certification ready</Text>
          <Text style={{ fontSize: 12, color: "rgba(255,255,255,0.9)", marginTop: 2 }}>
            Cycle {String(report.cycle.number).padStart(2, "0")} · {report.cycle.daysMonitored} days monitored
          </Text>
        </View>
      </LinearGradient>

      <SectionLabel>Cycle metrics</SectionLabel>
      <Card style={{ padding: 4 }}>
        {report.metrics.map((m, i) => (
          <View key={m.key} style={{ flexDirection: "row", justifyContent: "space-between", paddingVertical: 13, paddingHorizontal: 12, borderBottomWidth: i < report.metrics.length - 1 ? 1 : 0, borderBottomColor: C.line }}>
            <Text style={{ fontSize: 13.5, color: C.inkSoft }}>{m.label}</Text>
            <Text style={{ fontSize: 14.5, fontWeight: "700", color: C.ink }}>{m.value}</Text>
          </View>
        ))}
      </Card>

      <PrimaryButton label="Download Certification Report" icon={<Download size={18} color="#fff" />} onPress={() => openExport("json")} style={{ marginTop: 16 }} />
      <OutlineButton label="Export CSV" icon={<FileText size={18} color={C.blue} />} color={C.blue} onPress={() => openExport("csv")} style={{ marginTop: 10 }} />
    </Screen>
  );
}
