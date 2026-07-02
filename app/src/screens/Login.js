import React, { useState } from "react";
import { View, Text, Pressable, KeyboardAvoidingView, Platform, ActivityIndicator } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Leaf, Eye, EyeOff, CheckCircle2 } from "lucide-react-native";
import { C } from "../theme/tokens.js";
import { Field, PrimaryButton, OutlineButton } from "../components/ui.js";
import { api } from "../api/client.js";

export function Login({ onAuthed }) {
  const [phone, setPhone] = useState("08030000000");
  const [password, setPassword] = useState("password");
  const [show, setShow] = useState(false);
  const [remember, setRemember] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function submit(mode) {
    setBusy(true);
    setError("");
    try {
      const user = mode === "login" ? await api.login(phone, password) : await api.register(phone, password, "Farmer");
      onAuthed(user);
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1, backgroundColor: C.surface }}>
      <LinearGradient colors={[C.green, C.greenDark]} style={{ paddingTop: 46, paddingBottom: 40, paddingHorizontal: 26, borderBottomLeftRadius: 32, borderBottomRightRadius: 32 }}>
        <View style={{ width: 52, height: 52, borderRadius: 16, backgroundColor: "rgba(255,255,255,0.18)", alignItems: "center", justifyContent: "center" }}>
          <Leaf size={28} color="#fff" />
        </View>
        <Text style={{ fontSize: 23, fontWeight: "800", color: "#fff", marginTop: 18 }}>Welcome back</Text>
        <Text style={{ fontSize: 13, color: "rgba(255,255,255,0.85)", marginTop: 4 }}>Sign in to monitor your nursery</Text>
      </LinearGradient>

      <View style={{ padding: 26, flex: 1 }}>
        <Field label="Phone Number" placeholder="0803 000 0000" value={phone} onChangeText={setPhone} keyboardType="phone-pad" />
        <View style={{ height: 16 }} />
        <Field
          label="Password"
          placeholder="Password"
          value={password}
          onChangeText={setPassword}
          secureTextEntry={!show}
          right={
            <Pressable onPress={() => setShow(!show)}>
              {show ? <EyeOff size={18} color={C.inkSoft} /> : <Eye size={18} color={C.inkSoft} />}
            </Pressable>
          }
        />

        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginVertical: 16, marginHorizontal: 2 }}>
          <Pressable onPress={() => setRemember(!remember)} style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            <View style={{ width: 20, height: 20, borderRadius: 6, borderWidth: 1.5, borderColor: remember ? C.green : C.line, backgroundColor: remember ? C.green : "#fff", alignItems: "center", justifyContent: "center" }}>
              {remember ? <CheckCircle2 size={13} color="#fff" /> : null}
            </View>
            <Text style={{ fontSize: 13, color: C.inkSoft }}>Remember me</Text>
          </Pressable>
          <Text style={{ fontSize: 13, color: C.green, fontWeight: "600" }}>Forgot password?</Text>
        </View>

        {error ? <Text style={{ color: C.red, fontSize: 13, marginBottom: 12 }}>{error}</Text> : null}

        {busy ? (
          <ActivityIndicator color={C.green} style={{ marginVertical: 12 }} />
        ) : (
          <>
            <PrimaryButton label="Login" onPress={() => submit("login")} />
            <OutlineButton label="Register" onPress={() => submit("register")} style={{ marginTop: 12 }} />
          </>
        )}

        <Text style={{ fontSize: 11, color: C.inkSoft, textAlign: "center", marginTop: 18 }}>
          Demo account is pre-filled — just tap Login
        </Text>
      </View>
    </KeyboardAvoidingView>
  );
}
