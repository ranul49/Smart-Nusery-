import React, { useEffect, useState } from "react";
import { View, Text } from "react-native";
import { Leaf } from "lucide-react-native";
import { C } from "../theme/tokens.js";
import { Screen, SubHeader, Notice } from "../components/ui.js";
import { api } from "../api/client.js";

export function SmsView({ onBack }) {
  const [preview, setPreview] = useState(null);

  useEffect(() => {
    api.smsPreview().then(setPreview).catch(() => {});
  }, []);

  return (
    <Screen header={<SubHeader title="SMS Preview" onBack={onBack} />}>
      <Text style={{ fontSize: 13, color: C.inkSoft, marginBottom: 16 }}>
        Exactly how the farmer receives an alert when the network or app is offline.
      </Text>

      {!preview ? (
        <Notice text="Loading preview…" />
      ) : (
        <>
          <View style={{ maxWidth: 280, backgroundColor: "#fff", borderTopLeftRadius: 4, borderTopRightRadius: 18, borderBottomLeftRadius: 18, borderBottomRightRadius: 18, padding: 16, borderWidth: 1, borderColor: C.line }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 10, paddingBottom: 10, borderBottomWidth: 1, borderBottomColor: C.line }}>
              <View style={{ width: 30, height: 30, borderRadius: 9, backgroundColor: C.greenSoft, alignItems: "center", justifyContent: "center" }}>
                <Leaf size={16} color={C.green} />
              </View>
              <Text style={{ fontSize: 12.5, fontWeight: "800", color: C.green, letterSpacing: 0.3 }}>SMART CASSAVA NURSERY</Text>
            </View>
            {preview.fields.map((f) => (
              <View key={f.k} style={{ flexDirection: "row", justifyContent: "space-between", paddingVertical: 5 }}>
                <Text style={{ fontSize: 13, color: C.inkSoft }}>{f.k}</Text>
                <Text style={{ fontSize: 13, fontWeight: "600", color: f.k === "Humidity" ? C.amber : C.ink }}>{f.v}</Text>
              </View>
            ))}
          </View>
          <Text style={{ fontSize: 11, color: C.inkSoft, marginTop: 10, marginLeft: 4 }}>
            Delivered via {preview.channel} · {preview.fields.find((f) => f.k === "Time")?.v}
          </Text>
        </>
      )}
    </Screen>
  );
}
