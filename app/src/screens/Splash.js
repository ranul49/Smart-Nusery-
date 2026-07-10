import React, { useEffect, useRef } from "react";
import { View, Text, ActivityIndicator, Pressable } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Leaf, Cpu } from "lucide-react-native";
import { C } from "../theme/tokens.js";

export function Splash({ onDone }) {
  // Keep the latest onDone in a ref so a parent re-render (e.g. the session
  // restore call resolving) can't reset this timer and delay the splash.
  const onDoneRef = useRef(onDone);
  onDoneRef.current = onDone;

  useEffect(() => {
    const t = setTimeout(() => onDoneRef.current(), 2400);
    return () => clearTimeout(t);
  }, []);

  return (
    <Pressable onPress={onDone} style={{ flex: 1 }}>
      <LinearGradient colors={[C.greenDark, C.green, C.greenLight]} style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
        <View style={{ width: 96, height: 96, borderRadius: 28, backgroundColor: "rgba(255,255,255,0.16)", alignItems: "center", justifyContent: "center" }}>
          <Leaf size={48} color="#fff" />
        </View>
        <Text style={{ fontSize: 26, fontWeight: "800", color: "#fff", marginTop: 26 }}>Smart Cassava Nursery</Text>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 7, marginTop: 8 }}>
          <Cpu size={14} color="#fff" />
          <Text style={{ fontSize: 13, color: "rgba(255,255,255,0.85)" }}>IoT-Based Smart Seedling Monitoring</Text>
        </View>
        <View style={{ position: "absolute", bottom: 54 }}>
          <ActivityIndicator color="#fff" />
        </View>
        <Text style={{ position: "absolute", bottom: 22, fontSize: 11, color: "rgba(255,255,255,0.6)" }}>Project SEN-20-5112</Text>
      </LinearGradient>
    </Pressable>
  );
}
