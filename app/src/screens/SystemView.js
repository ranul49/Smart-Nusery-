import React, { useEffect, useState } from "react";
import { View, Text } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import {
  Thermometer, Cpu, Power, Waves, Fan, RadioTower, Cloud, Smartphone, Leaf, ArrowRight,
} from "lucide-react-native";
import { C } from "../theme/tokens.js";
import { Card, SectionLabel, Screen, SubHeader } from "../components/ui.js";
import { api } from "../api/client.js";

const COMPONENT_ICONS = {
  "Rooting tunnel": [Thermometer, C.green],
  "ESP32 controller": [Cpu, C.green],
  "Relay module": [Power, C.amber],
  "Water pump": [Waves, C.blue],
  "Cooling fan": [Fan, C.blue],
  "SIM800L GSM": [RadioTower, C.soil],
  "Cloud database": [Cloud, C.blue],
  "React Native app": [Smartphone, C.green],
};
const PIPE_ICONS = { Sense: Thermometer, Process: Cpu, Sync: Cloud, Notify: Smartphone, Act: Leaf };

export function SystemView({ onBack }) {
  const [arch, setArch] = useState(null);
  useEffect(() => {
    api.architecture().then(setArch).catch(() => {});
  }, []);

  return (
    <Screen header={<SubHeader title="System Architecture" onBack={onBack} />}>
      <LinearGradient colors={[C.greenDark, C.greenDark]} style={{ borderRadius: 20, padding: 18 }}>
        <Text style={{ fontSize: 16, fontWeight: "800", color: "#fff" }}>Data flow</Text>
        <Text style={{ fontSize: 12, color: "rgba(255,255,255,0.85)", marginTop: 3 }}>
          {arch?.flow || "Sensors → ESP32 → Cloud → App → Farmer"}
        </Text>
      </LinearGradient>

      <SectionLabel>Physical components</SectionLabel>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10 }}>
        {(arch?.components || []).map((comp) => {
          const [I, color] = COMPONENT_ICONS[comp.label] || [Cpu, C.green];
          return (
            <Card key={comp.label} style={{ width: "47%", padding: 12, flexDirection: "row", alignItems: "center", gap: 10 }}>
              <I size={20} color={color} />
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 12.5, color: C.ink, fontWeight: "500" }}>{comp.label}</Text>
                <Text style={{ fontSize: 10, color: C.inkSoft }}>{comp.role}</Text>
              </View>
            </Card>
          );
        })}
      </View>

      <Card style={{ marginTop: 12, flexDirection: "row", alignItems: "center", justifyContent: "space-around", backgroundColor: C.greenSoft, borderWidth: 0 }}>
        {(arch?.pipeline || ["Sense", "Process", "Sync", "Notify", "Act"]).map((label, i, arr) => {
          const I = PIPE_ICONS[label] || Cpu;
          return (
            <React.Fragment key={label}>
              <View style={{ alignItems: "center" }}>
                <I size={22} color={C.green} />
                <Text style={{ fontSize: 10, color: C.green, marginTop: 4, fontWeight: "600" }}>{label}</Text>
              </View>
              {i < arr.length - 1 ? <ArrowRight size={14} color={C.greenLight} /> : null}
            </React.Fragment>
          );
        })}
      </Card>
    </Screen>
  );
}
