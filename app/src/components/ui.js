import React from "react";
import { View, Text, Pressable, ScrollView, TextInput } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { ChevronLeft } from "lucide-react-native";
import { C, cardShadow } from "../theme/tokens.js";

export function Card({ children, style, onPress }) {
  const base = {
    backgroundColor: C.surface,
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    borderColor: C.line,
    ...cardShadow,
  };
  if (onPress) {
    return (
      <Pressable onPress={onPress} style={[base, style]}>
        {children}
      </Pressable>
    );
  }
  return <View style={[base, style]}>{children}</View>;
}

export function GradientCard({ colors, style, children }) {
  return (
    <LinearGradient colors={colors} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={[{ borderRadius: 20, padding: 20, overflow: "hidden" }, style]}>
      {children}
    </LinearGradient>
  );
}

export function Pill({ text, color, bg }) {
  return (
    <View style={{ backgroundColor: bg, paddingVertical: 3, paddingHorizontal: 9, borderRadius: 20, alignSelf: "flex-start" }}>
      <Text style={{ fontSize: 11, fontWeight: "600", color }}>{text}</Text>
    </View>
  );
}

export function PrimaryButton({ label, icon, onPress, color = C.green, style }) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        {
          width: "100%",
          paddingVertical: 15,
          borderRadius: 14,
          backgroundColor: color,
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "center",
          gap: 8,
          opacity: pressed ? 0.9 : 1,
          ...cardShadow,
        },
        style,
      ]}
    >
      {icon}
      <Text style={{ color: "#fff", fontSize: 15, fontWeight: "700" }}>{label}</Text>
    </Pressable>
  );
}

export function OutlineButton({ label, icon, onPress, color = C.green, style }) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        {
          width: "100%",
          paddingVertical: 15,
          borderRadius: 14,
          backgroundColor: "#fff",
          borderWidth: 1.5,
          borderColor: C.line,
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "center",
          gap: 8,
          opacity: pressed ? 0.9 : 1,
        },
        style,
      ]}
    >
      {icon}
      <Text style={{ color, fontSize: 15, fontWeight: "700" }}>{label}</Text>
    </Pressable>
  );
}

export function SectionLabel({ children }) {
  return (
    <Text style={{ fontSize: 13, fontWeight: "700", color: C.inkSoft, marginTop: 22, marginBottom: 12, marginHorizontal: 2 }}>
      {children}
    </Text>
  );
}

export function PageTitle({ title, sub, icon, bg }) {
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 13, marginBottom: 18 }}>
      <View style={{ width: 46, height: 46, borderRadius: 14, backgroundColor: bg, alignItems: "center", justifyContent: "center" }}>
        {icon}
      </View>
      <View>
        <Text style={{ fontSize: 22, fontWeight: "800", color: C.ink }}>{title}</Text>
        <Text style={{ fontSize: 12.5, color: C.inkSoft }}>{sub}</Text>
      </View>
    </View>
  );
}

export function SubHeader({ title, onBack }) {
  return (
    <View style={{ backgroundColor: C.surface, paddingHorizontal: 16, paddingVertical: 16, flexDirection: "row", alignItems: "center", gap: 12, borderBottomWidth: 1, borderBottomColor: C.line }}>
      <Pressable onPress={onBack} style={{ width: 38, height: 38, borderRadius: 12, borderWidth: 1, borderColor: C.line, backgroundColor: "#fff", alignItems: "center", justifyContent: "center" }}>
        <ChevronLeft size={20} color={C.ink} />
      </Pressable>
      <Text style={{ fontSize: 17, fontWeight: "800", color: C.ink }}>{title}</Text>
    </View>
  );
}

export function Screen({ children, header, contentStyle }) {
  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      {header}
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={[{ padding: 18, paddingBottom: 40 }, contentStyle]}
        showsVerticalScrollIndicator={false}
      >
        {children}
      </ScrollView>
    </View>
  );
}

export function Field({ label, value, onChangeText, placeholder, secureTextEntry, keyboardType, right }) {
  return (
    <View>
      <Text style={{ fontSize: 12, fontWeight: "600", color: C.inkSoft, marginBottom: 7 }}>{label}</Text>
      <View style={{ position: "relative", justifyContent: "center" }}>
        <TextInput
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={C.inkSoft}
          secureTextEntry={secureTextEntry}
          keyboardType={keyboardType}
          autoCapitalize="none"
          style={{
            width: "100%",
            paddingVertical: 14,
            paddingHorizontal: 16,
            borderRadius: 14,
            borderWidth: 1.5,
            borderColor: C.line,
            fontSize: 15,
            backgroundColor: C.bg,
            color: C.ink,
          }}
        />
        {right ? <View style={{ position: "absolute", right: 14 }}>{right}</View> : null}
      </View>
    </View>
  );
}

// Small helper for loading / error placeholders inside a screen.
export function Notice({ text }) {
  return (
    <View style={{ padding: 24, alignItems: "center" }}>
      <Text style={{ color: C.inkSoft, fontSize: 13 }}>{text}</Text>
    </View>
  );
}
